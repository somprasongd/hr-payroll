-- ===== Domains =====
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_run_status') THEN
    -- pending = รออนุมัติ, approved = อนุมัติแล้ว
    CREATE DOMAIN payroll_run_status AS TEXT
      CONSTRAINT payroll_run_status_chk
      CHECK (VALUE IN ('pending','approved'));
  END IF;
END$$;



-- ===== 1) payroll_run (หัวงวดทำเงินเดือน) =====
CREATE TABLE IF NOT EXISTS payroll_run (
  id                 UUID PRIMARY KEY DEFAULT uuidv7(),

  payroll_month_date DATE NOT NULL
    DEFAULT date_trunc('month', current_date)::date,
  CONSTRAINT payroll_run_month_ck
    CHECK (payroll_month_date = date_trunc('month', payroll_month_date)::date),

  period_start_date  DATE NOT NULL,
  pay_date           DATE NOT NULL DEFAULT current_date,

  social_security_rate_employee NUMERIC(6,5) NOT NULL,
  social_security_rate_employer NUMERIC(6,5) NOT NULL,

  status             payroll_run_status NOT NULL DEFAULT 'pending',

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID NOT NULL REFERENCES users(id),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID NOT NULL REFERENCES users(id),
  deleted_at   TIMESTAMPTZ NULL,
  deleted_by   UUID REFERENCES users(id),

  approved_at  TIMESTAMPTZ NULL,
  approved_by  UUID REFERENCES users(id),

  CONSTRAINT payroll_run_soft_delete_guard
    CHECK (deleted_at IS NULL OR status = 'pending'),

  CONSTRAINT payroll_run_dates_ck
    CHECK (pay_date >= period_start_date)
);

-- งวดซ้ำไม่ได้เมื่อยังไม่ถูกลบ
CREATE UNIQUE INDEX IF NOT EXISTS payroll_run_month_uk
  ON payroll_run (payroll_month_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS payroll_run_find_idx
  ON payroll_run (payroll_month_date, status)
  WHERE deleted_at IS NULL;

-- updated_at auto
DROP TRIGGER IF EXISTS tg_payroll_run_set_updated ON payroll_run;
CREATE TRIGGER tg_payroll_run_set_updated
BEFORE UPDATE ON payroll_run
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Guard: อนุมัติแล้วห้ามแก้/ลบ + บังคับเติม approved_at/by
CREATE OR REPLACE FUNCTION payroll_run_guard_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'approved' THEN
    IF ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*) THEN
      RAISE EXCEPTION 'Approved payroll_run cannot be modified or deleted';
    END IF;
  END IF;

  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    IF NEW.approved_by IS NULL THEN
      RAISE EXCEPTION 'approved_by is required when approving payroll_run';
    END IF;
    IF NEW.approved_at IS NULL THEN
      NEW.approved_at := now();
    END IF;
  END IF;

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS tg_payroll_run_guard_update ON payroll_run;
CREATE TRIGGER tg_payroll_run_guard_update
BEFORE UPDATE ON payroll_run
FOR EACH ROW EXECUTE FUNCTION payroll_run_guard_update();

-- ฟังก์ชัน: วันที่จ่ายเงินเดือนล่าสุดจากเอกสาร approved ที่ยังไม่ถูกลบ
CREATE OR REPLACE FUNCTION get_latest_payroll_pay_date()
RETURNS DATE
LANGUAGE sql
STABLE
AS $$
  SELECT max(pay_date)::date
  FROM payroll_run
  WHERE deleted_at IS NULL
    AND status = 'approved';
$$;

-- ===== 2) payroll_run_item (snapshot ต่อพนักงาน) =====

-- helper รวมค่าจาก JSON [{name, value}]
CREATE OR REPLACE FUNCTION jsonb_sum_value(p_items jsonb)
RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v NUMERIC := 0;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RETURN 0;
  END IF;
  SELECT COALESCE(sum((elem->>'value')::numeric),0)
    INTO v
  FROM jsonb_array_elements(p_items) AS elem
  WHERE (elem ? 'value') AND (elem->>'value') ~ '^-?[0-9]+(\.[0-9]+)?$';
  RETURN v;
END$$;

-- คำนวณภาษีก้าวหน้า ตาม brackets JSON [{min,max,rate}]
CREATE OR REPLACE FUNCTION calculate_progressive_tax(p_taxable NUMERIC, p_brackets JSONB)
RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_tax NUMERIC := 0;
  r RECORD;
  v_min NUMERIC;
  v_max NUMERIC;
  v_rate NUMERIC;
  v_slice NUMERIC;
BEGIN
  IF p_taxable IS NULL OR p_taxable <= 0 THEN
    RETURN 0;
  END IF;
  IF p_brackets IS NULL OR jsonb_typeof(p_brackets) <> 'array' THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT
      COALESCE((elem->>'min')::numeric, 0) AS min_val,
      CASE
        WHEN elem ? 'max' AND elem->>'max' IS NOT NULL AND lower(elem->>'max') <> 'null' THEN (elem->>'max')::numeric
        ELSE NULL
      END AS max_val,
      COALESCE((elem->>'rate')::numeric, 0) AS rate_val
    FROM jsonb_array_elements(p_brackets) elem
    ORDER BY COALESCE((elem->>'min')::numeric, 0)
  LOOP
    v_min := COALESCE(r.min_val, 0);
    v_max := r.max_val;
    v_rate := COALESCE(r.rate_val, 0);

    IF p_taxable <= v_min THEN
      CONTINUE;
    END IF;

    v_slice := LEAST(p_taxable, COALESCE(v_max, p_taxable)) - v_min;
    IF v_slice > 0 THEN
      v_tax := v_tax + (v_slice * v_rate);
    END IF;
  END LOOP;

  RETURN ROUND(v_tax, 2);
END$$;

-- คำนวณภาษีหัก ณ ที่จ่ายรายเดือน ตาม config + สถานะประกันสังคม
CREATE OR REPLACE FUNCTION calculate_withholding_tax(
  p_monthly_income NUMERIC,
  p_withhold_tax BOOLEAN,
  p_sso_contribute BOOLEAN,
  p_sso_rate_employee NUMERIC,
  p_sso_wage_cap NUMERIC,
  p_sso_base NUMERIC,
  p_tax_apply_standard_expense BOOLEAN,
  p_tax_standard_expense_rate NUMERIC,
  p_tax_standard_expense_cap NUMERIC,
  p_tax_apply_personal_allowance BOOLEAN,
  p_tax_personal_allowance_amount NUMERIC,
  p_tax_progressive_brackets JSONB,
  p_withholding_tax_rate_service NUMERIC
) RETURNS NUMERIC
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_income_month NUMERIC := COALESCE(p_monthly_income, 0);
  v_annual_income NUMERIC := 0;
  v_expense NUMERIC := 0;
  v_allowance NUMERIC := 0;
  v_taxable NUMERIC := 0;
  v_tax_annual NUMERIC := 0;
  v_sso_month NUMERIC := 0;
BEGIN
  IF NOT COALESCE(p_withhold_tax, false) THEN
    RETURN 0;
  END IF;

  -- แบบ ม.40(2): ฟรีแลนซ์/ไม่มีประกันสังคม ใช้อัตราหัก ณ ที่จ่ายเป็น % ของรายได้ต่อเดือน
  IF NOT COALESCE(p_sso_contribute, false) THEN
    RETURN ROUND(v_income_month * COALESCE(p_withholding_tax_rate_service, 0), 2);
  END IF;

  -- คำนวนยอดสมทบประกันสังคมต่อเดือน (ใช้เป็นส่วนลดหย่อน)
  v_sso_month := LEAST(COALESCE(p_sso_base, v_income_month), COALESCE(p_sso_wage_cap, v_income_month)) * COALESCE(p_sso_rate_employee, 0);

  -- แบบ ม.40(1): คำนวณรายได้ทั้งปี - ค่าใช้จ่ายเหมา - ค่าลดหย่อน แล้วคิดตามขั้น
  v_annual_income := v_income_month * 12;

  IF COALESCE(p_tax_apply_standard_expense, false) THEN
    v_expense := v_annual_income * COALESCE(p_tax_standard_expense_rate, 0);
    IF p_tax_standard_expense_cap IS NOT NULL THEN
      v_expense := LEAST(v_expense, p_tax_standard_expense_cap);
    END IF;
  END IF;

  IF COALESCE(p_tax_apply_personal_allowance, false) THEN
    v_allowance := COALESCE(p_tax_personal_allowance_amount, 0);
  END IF;

  v_taxable := GREATEST(v_annual_income - v_expense - v_allowance - (v_sso_month * 12), 0);

  v_tax_annual := calculate_progressive_tax(v_taxable, p_tax_progressive_brackets);

  RETURN ROUND(v_tax_annual / 12.0, 2);
END$$;

CREATE TABLE IF NOT EXISTS payroll_run_item (
  id                 UUID PRIMARY KEY DEFAULT uuidv7(),
  run_id             UUID NOT NULL REFERENCES payroll_run(id) ON DELETE CASCADE,
  employee_id        UUID NOT NULL REFERENCES employees(id),
  employee_type_id   UUID NOT NULL REFERENCES employee_type(id),
  employee_type_name TEXT NULL,
  department_name    TEXT NULL,
  position_name      TEXT NULL,
  bank_name          TEXT NULL,
  bank_account_no    TEXT NULL,

  -- รายได้
  salary_amount              NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  pt_hours_worked            NUMERIC(10,2) NOT NULL DEFAULT 0.00, -- ชั่วโมงทำงาน (ใช้สำหรับ Part-time)
  pt_hourly_rate             NUMERIC(12,2) NOT NULL DEFAULT 0.00, -- อัตราค่าจ้างต่อชั่วโมงของ Part-time
  ot_hours                   NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  ot_amount                  NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  housing_allowance          NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  attendance_bonus_nolate    NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  attendance_bonus_noleave   NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  bonus_amount               NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  leave_compensation_amount  NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  doctor_fee                 NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  others_income              JSONB NULL, -- [{name,value}]
  others_deduction           JSONB NULL, -- [{name,value}]
  income_total               NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  income_accum_prev          NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  income_accum_total         NUMERIC(14,2) NOT NULL DEFAULT 0.00,

  -- ขาดงาน/หักจากเวลา
  leave_days_qty             NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  leave_days_deduction       NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  leave_double_qty           NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  leave_double_deduction     NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  leave_hours_qty            NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  leave_hours_deduction      NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  late_minutes_qty           INTEGER       NOT NULL DEFAULT 0,
  late_minutes_deduction     NUMERIC(14,2) NOT NULL DEFAULT 0.00,

  -- ประกันสังคม
  sso_declared_wage          NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  sso_accum_prev             NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  sso_month_amount           NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  sso_accum_total            NUMERIC(14,2) NOT NULL DEFAULT 0.00,

  -- ภาษี
  tax_accum_prev             NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  tax_month_amount           NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  tax_accum_total            NUMERIC(14,2) NOT NULL DEFAULT 0.00,

  -- กองทุนสำรองเลี้ยงชีพ
  pf_accum_prev              NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  pf_month_amount            NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  pf_accum_total             NUMERIC(14,2) NOT NULL DEFAULT 0.00,

  -- ค่าสาธารณูปโภค
  water_meter_prev           NUMERIC(12,2),
  water_meter_curr           NUMERIC(12,2),
  water_rate_per_unit        NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  water_amount               NUMERIC(14,2) NOT NULL DEFAULT 0.00,

  electric_meter_prev        NUMERIC(12,2),
  electric_meter_curr        NUMERIC(12,2),
  electricity_rate_per_unit  NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  electric_amount            NUMERIC(14,2) NOT NULL DEFAULT 0.00,

  internet_amount            NUMERIC(14,2) NOT NULL DEFAULT 0.00,

  -- เบิกล่วงหน้า
  advance_amount             NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  advance_repay_amount       NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  advance_diff_amount        NUMERIC(14,2) NOT NULL DEFAULT 0.00,

  -- กู้ยืม
  loan_outstanding_prev      NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  loan_repayments            JSONB NULL,  -- [{name,value}]
  loan_outstanding_total     NUMERIC(14,2) NOT NULL DEFAULT 0.00,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID NOT NULL REFERENCES users(id),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID NOT NULL REFERENCES users(id),

  CONSTRAINT payroll_run_item_one_per_emp_per_run UNIQUE (run_id, employee_id)
);

CREATE INDEX IF NOT EXISTS payroll_run_item_run_idx ON payroll_run_item (run_id);
CREATE INDEX IF NOT EXISTS payroll_run_item_emp_idx ON payroll_run_item (employee_id);

-- updated_at auto
DROP TRIGGER IF EXISTS tg_payroll_run_item_set_updated ON payroll_run_item;
CREATE TRIGGER tg_payroll_run_item_set_updated
BEFORE UPDATE ON payroll_run_item
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Guard: สร้าง หรือ แก้ไขรายการได้เฉพาะเมื่อหัวงวดยัง pending
CREATE OR REPLACE FUNCTION payroll_run_item_guard_edit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM payroll_run WHERE id = COALESCE(NEW.run_id, OLD.run_id);

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Items can be created or edited only when payroll_run is pending (current: %)', v_status;
  END IF;
  RETURN NEW;
END$$;

-- Ensure trigger points to the updated function.
DROP TRIGGER IF EXISTS tg_payroll_run_item_guard_biu ON payroll_run_item;
CREATE TRIGGER tg_payroll_run_item_guard_biu
BEFORE INSERT OR UPDATE ON payroll_run_item
FOR EACH ROW EXECUTE FUNCTION payroll_run_item_guard_edit();

-- คำนวณสรุปฟิลด์อัตโนมัติ
CREATE OR REPLACE FUNCTION payroll_run_item_compute_totals()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_others_income NUMERIC := 0;
  v_loan_paid     NUMERIC := 0;
BEGIN
  v_others_income := jsonb_sum_value(NEW.others_income);
  v_loan_paid     := jsonb_sum_value(NEW.loan_repayments);

  NEW.income_total :=
      COALESCE(NEW.salary_amount,0) +
      COALESCE(NEW.ot_amount,0) +
      COALESCE(NEW.housing_allowance,0) +
      COALESCE(NEW.attendance_bonus_nolate,0) +
      COALESCE(NEW.attendance_bonus_noleave,0) +
      COALESCE(NEW.bonus_amount,0) +
      COALESCE(NEW.leave_compensation_amount,0) +
      COALESCE(NEW.doctor_fee,0) +
      COALESCE(v_others_income,0);

  NEW.income_accum_total := COALESCE(NEW.income_accum_prev,0) + COALESCE(NEW.income_total,0);
  NEW.sso_accum_total := COALESCE(NEW.sso_accum_prev,0) + COALESCE(NEW.sso_month_amount,0);
  NEW.tax_accum_total := COALESCE(NEW.tax_accum_prev,0) + COALESCE(NEW.tax_month_amount,0);
  NEW.pf_accum_total  := COALESCE(NEW.pf_accum_prev,0)  + COALESCE(NEW.pf_month_amount,0);

  NEW.advance_diff_amount := COALESCE(NEW.advance_amount,0) - COALESCE(NEW.advance_repay_amount,0);

  NEW.loan_outstanding_total :=
      COALESCE(NEW.loan_outstanding_prev,0) +
      COALESCE(NEW.advance_diff_amount,0) -
      COALESCE(v_loan_paid,0);

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS tg_payroll_run_item_compute_biu ON payroll_run_item;
CREATE TRIGGER tg_payroll_run_item_compute_biu
BEFORE INSERT OR UPDATE ON payroll_run_item
FOR EACH ROW EXECUTE FUNCTION payroll_run_item_compute_totals();

-- 1. สร้างฟังก์ชันสำหรับ Generate รายการในสลิปเงินเดือน
CREATE OR REPLACE FUNCTION public.payroll_run_generate_items() RETURNS trigger AS $$
DECLARE
  v_config RECORD;
  v_emp RECORD;
  v_end_date DATE;
  
  -- ตัวแปรสำหรับ Full-time
  v_ft_salary NUMERIC(14,2);
  v_ot_hours NUMERIC(10,2);
  v_ot_amount NUMERIC(14,2);
  v_late_mins INT;
  v_late_deduct NUMERIC(14,2);
  
  v_leave_days NUMERIC(10,2);
  v_leave_deduct NUMERIC(14,2);
  
  v_leave_double_days NUMERIC(10,2);
  v_leave_double_deduct NUMERIC(14,2);
  
  v_leave_hours NUMERIC(10,2);
  v_leave_hours_deduct NUMERIC(14,2);
  
  v_bonus_amt NUMERIC(14,2);
  v_adv NUMERIC(14,2);
  v_loan_repay_json JSONB;
  v_loan_total NUMERIC(14,2);
  v_others_income JSONB := '[]'::jsonb;
  v_others_deduction JSONB := '[]'::jsonb;
  v_doctor_fee NUMERIC(14,2) := 0;
  v_sso_prev NUMERIC(14,2) := 0;
  v_sso_cap NUMERIC(14,2) := 15000.00;
  v_sso_base NUMERIC(14,2) := 0;
  v_sso_amount NUMERIC(14,2) := 0;
  v_tax_prev NUMERIC(14,2) := 0;
  v_income_prev NUMERIC(14,2) := 0;
  v_pf_prev  NUMERIC(14,2) := 0;
  v_pf_amount NUMERIC(14,2) := 0;
  v_water_prev NUMERIC(12,2);
  v_electric_prev NUMERIC(12,2);
  v_income_total NUMERIC(14,2) := 0;
  v_tax_month NUMERIC(14,2) := 0;
  
  -- ตัวแปรสำหรับ Part-time
  v_pt_hours NUMERIC(10,2);
  
BEGIN
  -- 1. หา Config ที่ตรงกับเดือนที่จ่าย
  SELECT * INTO v_config 
  FROM get_effective_payroll_config(NEW.payroll_month_date);

  IF v_config IS NULL THEN
    RAISE EXCEPTION 'ไม่พบ Payroll Config สำหรับงวดวันที่ %', NEW.payroll_month_date;
  END IF;

  -- คำนวณวันสิ้นงวด
  v_end_date := (NEW.payroll_month_date + interval '1 month' - interval '1 day')::date;
  v_sso_cap := LEAST(COALESCE(v_config.social_security_wage_cap, 15000.00), 15000.00);

  -- 2. วนลูปพนักงานทุกคนที่ Active
  FOR v_emp IN 
    SELECT e.*, t.code as type_code, t.name_th AS employee_type_name,
           d.name_th AS department_name, ep.name_th AS position_name
    FROM employees e
    JOIN employee_type t ON t.id = e.employee_type_id
    LEFT JOIN department d ON d.id = e.department_id
    LEFT JOIN employee_position ep ON ep.id = e.position_id
    WHERE e.deleted_at IS NULL
      AND (e.employment_end_date IS NULL OR e.employment_end_date >= NEW.period_start_date)
  LOOP
    
    -- Reset ตัวแปรต่อคน
    v_ft_salary := 0; v_ot_hours := 0; v_ot_amount := 0;
    v_late_mins := 0; v_late_deduct := 0; 
    v_leave_days := 0; v_leave_deduct := 0;
    v_leave_double_days := 0; v_leave_double_deduct := 0;
    v_leave_hours := 0; v_leave_hours_deduct := 0;
    v_bonus_amt := 0; v_adv := 0; 
    v_loan_repay_json := '[]'::jsonb; v_loan_total := 0;
    v_pt_hours := 0; v_others_income := '[]'::jsonb; v_others_deduction := '[]'::jsonb; v_doctor_fee := 0;
    v_sso_prev := 0; v_sso_base := 0; v_sso_amount := 0;
    v_tax_prev := 0; v_income_prev := 0; v_pf_prev := 0; v_pf_amount := 0;
    v_water_prev := NULL; v_electric_prev := NULL;

    -- ============================================================
    -- CASE 1: พนักงานประจำ (Full-Time)
    -- ============================================================
    IF v_emp.type_code = 'full_time' THEN
      -- A. เงินเดือนตั้งต้น
      v_ft_salary := v_emp.base_pay_amount;

      -- B. ดึง Worklog FT (OT)
      SELECT COALESCE(SUM(quantity), 0) INTO v_ot_hours
      FROM worklog_ft 
      WHERE employee_id = v_emp.id AND entry_type = 'ot' 
        AND work_date BETWEEN NEW.period_start_date AND v_end_date
        AND status IN ('pending', 'approved') AND deleted_at IS NULL;
      
      v_ot_amount := v_ot_hours * v_config.ot_hourly_rate;

      -- C. คำนวณรายการหัก (Deductions)
      
      -- 1) มาสาย (Late)
      SELECT COALESCE(SUM(quantity), 0) INTO v_late_mins
      FROM worklog_ft 
      WHERE employee_id = v_emp.id AND entry_type = 'late'
        AND work_date BETWEEN NEW.period_start_date AND v_end_date
        AND status IN ('pending', 'approved') AND deleted_at IS NULL;
      
      -- สูตรหักสาย: ถ้านาทีสาย > 15 นาที ให้หักนาทีละ 5 บาท
      IF v_late_mins > 15 THEN
        v_late_deduct := v_late_mins * 5;
      ELSE
        v_late_deduct := 0;
      END IF;

      -- 2) ลาป่วย/กิจ (Leave Day)
      SELECT COALESCE(SUM(quantity), 0) INTO v_leave_days
      FROM worklog_ft 
      WHERE employee_id = v_emp.id AND entry_type = 'leave_day'
        AND work_date BETWEEN NEW.period_start_date AND v_end_date
        AND status IN ('pending', 'approved') AND deleted_at IS NULL;
      
      -- สูตรหักลา: (เงินเดือน / 30) * วัน
      v_leave_deduct := ROUND((v_emp.base_pay_amount / 30.0) * v_leave_days, 2);

      -- 3) ลาหัก 2 เท่า (Leave Double)
      SELECT COALESCE(SUM(quantity), 0) INTO v_leave_double_days
      FROM worklog_ft 
      WHERE employee_id = v_emp.id AND entry_type = 'leave_double'
        AND work_date BETWEEN NEW.period_start_date AND v_end_date
        AND status IN ('pending', 'approved') AND deleted_at IS NULL;
      
      -- สูตรหักลา 2 เท่า: (เงินเดือน / 30) * 2 * วัน
      v_leave_double_deduct := ROUND(((v_emp.base_pay_amount / 30.0) * 2) * v_leave_double_days, 2);

      -- 4) ลารายชั่วโมง (Leave Hours)
      SELECT COALESCE(SUM(quantity), 0) INTO v_leave_hours
      FROM worklog_ft 
      WHERE employee_id = v_emp.id AND entry_type = 'leave_hours'
        AND work_date BETWEEN NEW.period_start_date AND v_end_date
        AND status IN ('pending', 'approved') AND deleted_at IS NULL;
      
      -- สูตรหักลาชั่วโมง: ((เงินเดือน / 30) / 8) * ชั่วโมง
      v_leave_hours_deduct := ROUND(((v_emp.base_pay_amount / 30.0) / 8.0) * v_leave_hours, 2);

      -- D. การเงินอื่นๆ (Advance, Debt, Bonus)
      SELECT COALESCE(SUM(amount), 0) INTO v_adv
      FROM salary_advance
      WHERE employee_id = v_emp.id AND payroll_month_date = NEW.payroll_month_date AND status = 'pending' AND deleted_at IS NULL;

      SELECT jsonb_agg(jsonb_build_object('txn_id', id, 'amount', amount, 'reason', 'Installment')), COALESCE(SUM(amount), 0)
      INTO v_loan_repay_json, v_loan_total
      FROM debt_txn
      WHERE employee_id = v_emp.id AND txn_type = 'installment' AND payroll_month_date = NEW.payroll_month_date AND status = 'pending' AND deleted_at IS NULL;
        
      IF v_loan_repay_json IS NULL THEN v_loan_repay_json := '[]'::jsonb; END IF;

      SELECT COALESCE(SUM(bi.bonus_amount), 0) INTO v_bonus_amt
      FROM bonus_item bi JOIN bonus_cycle bc ON bc.id = bi.cycle_id
      WHERE bi.employee_id = v_emp.id AND bc.payroll_month_date = NEW.payroll_month_date AND bc.status = 'approved' AND bc.deleted_at IS NULL;

    -- ============================================================
    -- CASE 2: พนักงาน Part-Time
    -- ============================================================
    ELSIF v_emp.type_code = 'part_time' THEN
      -- ดึงชั่วโมงทำงานรวม (ตัดรายการที่ถูกจ่ายผ่าน payout_pt แล้ว)
      SELECT COALESCE(SUM(w.total_hours), 0) INTO v_pt_hours
      FROM worklog_pt w
      WHERE w.employee_id = v_emp.id
        AND w.work_date BETWEEN NEW.period_start_date AND v_end_date
        AND w.status IN ('pending', 'approved')
        AND w.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM payout_pt_item pi
          JOIN payout_pt p ON p.id = pi.payout_id
          WHERE pi.worklog_id = w.id
            AND pi.deleted_at IS NULL
            AND p.deleted_at IS NULL
            AND p.status = 'paid'
        );

      -- v_emp.base_pay_amount คือ Hourly Rate
      v_ft_salary := ROUND(v_pt_hours * v_emp.base_pay_amount, 2);
      
    END IF;

    -- ดึงยอดสะสม (ปีเดียวกับงวด, PF สะสมตลอดชีพ accum_year = NULL)
    SELECT COALESCE(amount, 0) INTO v_sso_prev
    FROM payroll_accumulation
    WHERE employee_id = v_emp.id AND accum_type = 'sso' AND accum_year = EXTRACT(YEAR FROM NEW.payroll_month_date);

    SELECT COALESCE(amount, 0) INTO v_tax_prev
    FROM payroll_accumulation
    WHERE employee_id = v_emp.id AND accum_type = 'tax' AND accum_year = EXTRACT(YEAR FROM NEW.payroll_month_date);

    SELECT COALESCE(amount, 0) INTO v_income_prev
    FROM payroll_accumulation
    WHERE employee_id = v_emp.id AND accum_type = 'income' AND accum_year = EXTRACT(YEAR FROM NEW.payroll_month_date);

    SELECT COALESCE(amount, 0) INTO v_pf_prev
    FROM payroll_accumulation
    WHERE employee_id = v_emp.id AND accum_type = 'pf' AND accum_year IS NULL;

    -- SSO: use declared wage (capped 15,000) times run rate when enabled
    v_sso_base := 0; v_sso_amount := 0;
    IF v_emp.sso_contribute THEN
      IF v_emp.type_code = 'full_time' THEN
        v_sso_base := v_emp.sso_declared_wage;
      ELSE
        v_sso_base := LEAST(v_ft_salary, v_sso_cap);
      END IF;
      v_sso_base := LEAST(COALESCE(v_sso_base, 0), v_sso_cap);
      v_sso_amount := ROUND(v_sso_base * NEW.social_security_rate_employee, 2);
  END IF;

  -- Provident fund: calculate this month's deduction from wage base
  v_pf_amount := 0;
  IF v_emp.provident_fund_contribute THEN
      v_pf_amount := ROUND(COALESCE(v_ft_salary, 0) * COALESCE(v_emp.provident_fund_rate_employee, 0), 2);
  END IF;

    -- Doctor fee allowance defaults to 0 when enabled
    IF v_emp.allow_doctor_fee THEN
      v_doctor_fee := 0;
    END IF;

    -- สรุปรายได้ต่อเดือนเพื่อใช้คำนวณภาษีหัก ณ ที่จ่าย
    v_income_total :=
        COALESCE(v_ft_salary,0) +
        COALESCE(v_ot_amount,0) +
        CASE WHEN v_emp.type_code = 'full_time' AND v_emp.allow_housing THEN v_config.housing_allowance ELSE 0 END +
        CASE
          WHEN v_emp.type_code = 'full_time' AND v_ft_salary > 0 AND v_late_deduct = 0
            THEN v_config.attendance_bonus_no_late
          ELSE 0
        END +
        CASE
          WHEN v_emp.type_code = 'full_time' AND v_ft_salary > 0
               AND v_leave_deduct = 0 AND v_leave_double_deduct = 0 AND v_leave_hours_deduct = 0
            THEN v_config.attendance_bonus_no_leave
          ELSE 0
        END +
        COALESCE(v_bonus_amt,0) +
        COALESCE(v_doctor_fee,0) +
        COALESCE(jsonb_sum_value(v_others_income),0);

    v_tax_month := calculate_withholding_tax(
      v_income_total,
      v_emp.withhold_tax,
      v_emp.sso_contribute,
      NEW.social_security_rate_employee,
      v_sso_cap,
      v_sso_base,
      v_config.tax_apply_standard_expense,
      v_config.tax_standard_expense_rate,
      v_config.tax_standard_expense_cap,
      v_config.tax_apply_personal_allowance,
      v_config.tax_personal_allowance_amount,
      v_config.tax_progressive_brackets,
      v_config.withholding_tax_rate_service
    );

    -- ============================================================
    -- 3. INSERT ลงตาราง payroll_run_item
    -- ============================================================
  INSERT INTO payroll_run_item (
      run_id, employee_id, employee_type_id, employee_type_name,
      department_name, position_name, bank_name, bank_account_no,
      salary_amount, pt_hours_worked, pt_hourly_rate, ot_hours, ot_amount, bonus_amount,
      housing_allowance, attendance_bonus_nolate, attendance_bonus_noleave,
      
      late_minutes_qty, late_minutes_deduction,
      leave_days_qty, leave_days_deduction,
      leave_double_qty, leave_double_deduction,
      leave_hours_qty, leave_hours_deduction,
      
      advance_amount, loan_repayments, loan_outstanding_prev, income_accum_prev,
      sso_declared_wage, sso_month_amount, sso_accum_prev,
      tax_accum_prev, tax_month_amount, pf_accum_prev, pf_month_amount,
      doctor_fee, others_income, others_deduction,
      water_meter_prev, water_meter_curr, water_rate_per_unit, water_amount,
      electric_meter_prev, electric_meter_curr, electricity_rate_per_unit, electric_amount,
      internet_amount,
      created_by, updated_by
    )
    VALUES (
      NEW.id, v_emp.id, v_emp.employee_type_id, v_emp.employee_type_name,
      v_emp.department_name, v_emp.position_name, v_emp.bank_name, v_emp.bank_account_no,
      v_ft_salary,
      CASE WHEN v_emp.type_code = 'part_time' THEN v_pt_hours ELSE 0 END,
      CASE WHEN v_emp.type_code = 'part_time' THEN v_emp.base_pay_amount ELSE 0 END,
      v_ot_hours, v_ot_amount, v_bonus_amt,
      
      -- สวัสดิการ (เฉพาะ Full-time หรือตามเงื่อนไข)
      CASE WHEN v_emp.type_code = 'full_time' AND v_emp.allow_housing THEN v_config.housing_allowance ELSE 0 END,
      CASE
        WHEN v_emp.type_code = 'full_time' AND v_ft_salary > 0 AND v_late_deduct = 0
          THEN v_config.attendance_bonus_no_late
        ELSE 0
      END,
      CASE
        WHEN v_emp.type_code = 'full_time' AND v_ft_salary > 0
             AND v_leave_deduct = 0 AND v_leave_double_deduct = 0 AND v_leave_hours_deduct = 0
          THEN v_config.attendance_bonus_no_leave
        ELSE 0
      END,
      
      v_late_mins, v_late_deduct,
      v_leave_days, v_leave_deduct,
      v_leave_double_days, v_leave_double_deduct,
      v_leave_hours, v_leave_hours_deduct,
      
      v_adv, v_loan_repay_json,
      COALESCE((SELECT amount FROM payroll_accumulation WHERE employee_id = v_emp.id AND accum_type = 'loan_outstanding'), 0),
      COALESCE(v_income_prev,0),
      
      -- ฐาน SSO (Full-time ใช้ sso_declared_wage, Part-time อาจใช้รายได้จริงแต่ไม่เกินเพดาน)
      v_sso_base, v_sso_amount,
      COALESCE(v_sso_prev,0),
      COALESCE(v_tax_prev,0), v_tax_month, COALESCE(v_pf_prev,0), v_pf_amount,
      v_doctor_fee, v_others_income, v_others_deduction,
      v_water_prev, NULL, v_config.water_rate_per_unit, 0,
      v_electric_prev, NULL, v_config.electricity_rate_per_unit, 0,
      CASE WHEN v_emp.allow_internet THEN v_config.internet_fee_monthly ELSE 0 END,
      
      NEW.created_by, NEW.created_by
    );
    
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. ผูก Trigger
DROP TRIGGER IF EXISTS tg_payroll_run_generate_items ON public.payroll_run;

CREATE TRIGGER tg_payroll_run_generate_items
AFTER INSERT ON public.payroll_run
FOR EACH ROW
EXECUTE FUNCTION public.payroll_run_generate_items();

-- ฟังก์ชันเมื่อ Payroll Run ผ่านการอนุมัติ
CREATE OR REPLACE FUNCTION public.payroll_run_on_approve_actions() RETURNS trigger AS $$
DECLARE
  v_end_date DATE;
  v_year INT;
BEGIN
  -- ทำงานเฉพาะเมื่อมีการเปลี่ยนสถานะเป็น 'approved'
  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    
    -- เตรียมตัวแปร
    -- 1. วันสิ้นงวด (สำหรับ Filter Worklog)
    v_end_date := (NEW.payroll_month_date + interval '1 month' - interval '1 day')::date;
    -- 2. ปีปฏิทิน (สำหรับ Accumulation)
    v_year := EXTRACT(YEAR FROM NEW.payroll_month_date)::INT;

    -- =================================================================
    -- 1. อัปเดตสถานะ Worklog (FT & PT) -> Approved
    -- =================================================================
    -- 1.1 Worklog FT
    UPDATE worklog_ft w
    SET status = 'approved',
        updated_at = now(),
        updated_by = NEW.updated_by
    FROM payroll_run_item pri
    WHERE pri.run_id = NEW.id
      AND w.employee_id = pri.employee_id
      AND w.work_date >= NEW.period_start_date AND w.work_date <= v_end_date
      AND w.status = 'pending'
      AND w.deleted_at IS NULL;

    -- 1.2 Worklog PT
    UPDATE worklog_pt w
    SET status = 'approved',
        updated_at = now(),
        updated_by = NEW.updated_by
    FROM payroll_run_item pri
    WHERE pri.run_id = NEW.id
      AND w.employee_id = pri.employee_id
      AND w.work_date >= NEW.period_start_date AND w.work_date <= v_end_date
      AND w.status = 'pending'
      AND w.deleted_at IS NULL;

    -- =================================================================
    -- 2. อัปเดต Salary Advance -> Processed
    -- =================================================================
    -- Logic: เลือกรายการที่ Pending และระบุงวดเดือนตรงกับ Payroll นี้
    UPDATE salary_advance sa
    SET status = 'processed',
        updated_at = now(),
        updated_by = NEW.updated_by
    FROM payroll_run_item pri
    WHERE pri.run_id = NEW.id
      AND sa.employee_id = pri.employee_id
      AND sa.payroll_month_date = NEW.payroll_month_date
      AND sa.status = 'pending'
      AND sa.deleted_at IS NULL;

    -- =================================================================
    -- 3. อัปเดต Debt Transaction -> Approved
    -- =================================================================
    -- Logic: อนุมัติทั้ง installment (งวดผ่อน) และ repayment (หักโปะผ่านหน้าจอ)
    -- หมายเหตุ: การ Update นี้จะไป Trigger 'tg_sync_loan_balance' ให้ทำงานต่อเอง
    UPDATE debt_txn dt
    SET status = 'approved',
        updated_at = now(),
        updated_by = NEW.updated_by
    FROM payroll_run_item pri
    WHERE pri.run_id = NEW.id
      AND dt.employee_id = pri.employee_id
      AND dt.payroll_month_date = NEW.payroll_month_date
      AND dt.txn_type IN ('installment', 'repayment')
      AND dt.status = 'pending'
      AND dt.deleted_at IS NULL;

    -- =================================================================
    -- 4. อัปเดต Payroll Accumulation (SSO, Tax, Income, PF)
    -- =================================================================
    
    -- 4.1 SSO (รายปี)
    INSERT INTO payroll_accumulation (
      employee_id, accum_type, accum_year, amount, updated_at, updated_by
    )
    SELECT 
      pri.employee_id, 'sso', v_year, pri.sso_month_amount, now(), NEW.updated_by
    FROM payroll_run_item pri
    WHERE pri.run_id = NEW.id AND pri.sso_month_amount > 0
    ON CONFLICT (employee_id, accum_type, COALESCE(accum_year, -1))
    DO UPDATE SET 
      amount = payroll_accumulation.amount + EXCLUDED.amount,
      updated_at = EXCLUDED.updated_at,
      updated_by = EXCLUDED.updated_by;

    -- 4.2 TAX (รายปี)
    INSERT INTO payroll_accumulation (
      employee_id, accum_type, accum_year, amount, updated_at, updated_by
    )
    SELECT 
      pri.employee_id, 'tax', v_year, pri.tax_month_amount, now(), NEW.updated_by
    FROM payroll_run_item pri
    WHERE pri.run_id = NEW.id AND pri.tax_month_amount > 0
    ON CONFLICT (employee_id, accum_type, COALESCE(accum_year, -1))
    DO UPDATE SET 
      amount = payroll_accumulation.amount + EXCLUDED.amount,
      updated_at = EXCLUDED.updated_at,
      updated_by = EXCLUDED.updated_by;

    -- 4.3 Income (รายปี)
    INSERT INTO payroll_accumulation (
      employee_id, accum_type, accum_year, amount, updated_at, updated_by
    )
    SELECT 
      pri.employee_id, 'income', v_year, pri.income_total, now(), NEW.updated_by
    FROM payroll_run_item pri
    WHERE pri.run_id = NEW.id AND pri.income_total > 0
    ON CONFLICT (employee_id, accum_type, COALESCE(accum_year, -1))
    DO UPDATE SET 
      amount = payroll_accumulation.amount + EXCLUDED.amount,
      updated_at = EXCLUDED.updated_at,
      updated_by = EXCLUDED.updated_by;

    -- 4.4 Provident Fund (ตลอดชีพ / accum_year = NULL)
    INSERT INTO payroll_accumulation (
      employee_id, accum_type, accum_year, amount, updated_at, updated_by
    )
    SELECT 
      pri.employee_id, 'pf', NULL, pri.pf_month_amount, now(), NEW.updated_by
    FROM payroll_run_item pri
    WHERE pri.run_id = NEW.id AND pri.pf_month_amount > 0
    ON CONFLICT (employee_id, accum_type, COALESCE(accum_year, -1))
    DO UPDATE SET 
      amount = payroll_accumulation.amount + EXCLUDED.amount,
      updated_at = EXCLUDED.updated_at,
      updated_by = EXCLUDED.updated_by;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_payroll_run_on_approve_actions ON public.payroll_run;

CREATE TRIGGER tg_payroll_run_on_approve_actions
AFTER UPDATE ON public.payroll_run
FOR EACH ROW
EXECUTE FUNCTION public.payroll_run_on_approve_actions();

--- =============================================
--- สร้างฟังก์ชันกลางสำหรับคำนวณและอัปเดต Item รายคน
--- ฟังก์ชันนี้จะรับ run_id และ employee_id เข้าไปคำนวณยอดใหม่ทั้งหมดตามสูตรล่าสุด แล้วสั่ง UPDATE ลงในตาราง payroll_run_item
--- ด้วยชุดคำสั่งนี้:
--- 1. ถ้า HR แก้เงินเดือนพนักงาน -> Payroll งวดปัจจุบัน (Pending) จะเปลี่ยนยอด Salary ทันที
--- 2. ถ้า HR ลงเวลาสายเพิ่ม -> Payroll จะหักเงินค่าสายเพิ่มทันที
--- 3. ถ้า HR แก้ยอดหนี้ -> สลิปเงินเดือนจะแสดงยอดหักหนี้ใหม่ทันที
--- =============================================
CREATE OR REPLACE FUNCTION public.recalculate_payroll_item(p_run_id UUID, p_employee_id UUID) RETURNS void AS $$
DECLARE
  v_run RECORD;
  v_config RECORD;
  v_emp RECORD;
  v_end_date DATE;
  
  -- ตัวแปรคำนวณ
  v_ft_salary NUMERIC(14,2) := 0;
  v_pt_hours NUMERIC(10,2) := 0;
  v_ot_hours NUMERIC(10,2) := 0;
  v_ot_amount NUMERIC(14,2) := 0;
  
  v_late_mins INT := 0;
  v_late_deduct NUMERIC(14,2) := 0;
  
  v_leave_days NUMERIC(10,2) := 0;
  v_leave_deduct NUMERIC(14,2) := 0;
  v_leave_double_days NUMERIC(10,2) := 0;
  v_leave_double_deduct NUMERIC(14,2) := 0;
  v_leave_hours NUMERIC(10,2) := 0;
  v_leave_hours_deduct NUMERIC(14,2) := 0;
  
  v_bonus_amt NUMERIC(14,2) := 0;
  v_adv NUMERIC(14,2) := 0;
  v_loan_repay_json JSONB;
  v_loan_total NUMERIC(14,2) := 0;
  v_others_income JSONB := '[]'::jsonb;
  v_others_deduction JSONB := '[]'::jsonb;
  v_doctor_fee NUMERIC(14,2) := 0;
  v_sso_prev NUMERIC(14,2) := 0;
  v_sso_cap NUMERIC(14,2) := 15000.00;
  v_sso_base NUMERIC(14,2) := 0;
  v_sso_amount NUMERIC(14,2) := 0;
  v_tax_prev NUMERIC(14,2) := 0;
  v_income_prev NUMERIC(14,2) := 0;
  v_pf_prev  NUMERIC(14,2) := 0;
  v_pf_amount NUMERIC(14,2) := 0;
  v_water_prev NUMERIC(12,2);
  v_electric_prev NUMERIC(12,2);
  v_income_total NUMERIC(14,2) := 0;
  v_tax_month NUMERIC(14,2) := 0;
  
BEGIN
  -- 1. ดึงข้อมูล Payroll Run และ Config
  SELECT * INTO v_run FROM payroll_run WHERE id = p_run_id;
  
  -- ถ้าสถานะไม่ใช่ pending ให้จบการทำงาน (แก้ไขไม่ได้แล้ว)
  IF v_run.status <> 'pending' THEN
    RETURN;
  END IF;

  SELECT * INTO v_config FROM get_effective_payroll_config(v_run.payroll_month_date);
  v_end_date := (v_run.payroll_month_date + interval '1 month' - interval '1 day')::date;
  v_sso_cap := LEAST(COALESCE(v_config.social_security_wage_cap, 15000.00), 15000.00);

  -- 2. ดึงข้อมูลพนักงาน
  SELECT e.*, t.code as type_code, t.name_th AS employee_type_name,
         d.name_th AS department_name, ep.name_th AS position_name
  INTO v_emp
  FROM employees e
  JOIN employee_type t ON t.id = e.employee_type_id
  LEFT JOIN department d ON d.id = e.department_id
  LEFT JOIN employee_position ep ON ep.id = e.position_id
  WHERE e.id = p_employee_id;

  IF v_emp IS NULL THEN RETURN; END IF;

  -- 3. คำนวณตามสูตร (Logic เดียวกับ payroll_run_generate_items)
  
  -- === CASE 1: Full-Time ===
  IF v_emp.type_code = 'full_time' THEN
    v_ft_salary := v_emp.base_pay_amount;

    -- OT
    SELECT COALESCE(SUM(quantity), 0) INTO v_ot_hours
    FROM worklog_ft 
    WHERE employee_id = v_emp.id AND entry_type = 'ot' 
      AND work_date BETWEEN v_run.period_start_date AND v_end_date
      AND status IN ('pending', 'approved') AND deleted_at IS NULL;
    v_ot_amount := v_ot_hours * v_config.ot_hourly_rate;

    -- Late (>15 mins * 5)
    SELECT COALESCE(SUM(quantity), 0) INTO v_late_mins
    FROM worklog_ft 
    WHERE employee_id = v_emp.id AND entry_type = 'late'
      AND work_date BETWEEN v_run.period_start_date AND v_end_date
      AND status IN ('pending', 'approved') AND deleted_at IS NULL;
    
    IF v_late_mins > 15 THEN v_late_deduct := v_late_mins * 5; END IF;

    -- Leave (Days)
    SELECT COALESCE(SUM(quantity), 0) INTO v_leave_days
    FROM worklog_ft 
    WHERE employee_id = v_emp.id AND entry_type = 'leave_day'
      AND work_date BETWEEN v_run.period_start_date AND v_end_date
      AND status IN ('pending', 'approved') AND deleted_at IS NULL;
    v_leave_deduct := ROUND((v_emp.base_pay_amount / 30.0) * v_leave_days, 2);

    -- Leave (Double)
    SELECT COALESCE(SUM(quantity), 0) INTO v_leave_double_days
    FROM worklog_ft 
    WHERE employee_id = v_emp.id AND entry_type = 'leave_double'
      AND work_date BETWEEN v_run.period_start_date AND v_end_date
      AND status IN ('pending', 'approved') AND deleted_at IS NULL;
    v_leave_double_deduct := ROUND(((v_emp.base_pay_amount / 30.0) * 2) * v_leave_double_days, 2);

    -- Leave (Hours)
    SELECT COALESCE(SUM(quantity), 0) INTO v_leave_hours
    FROM worklog_ft 
    WHERE employee_id = v_emp.id AND entry_type = 'leave_hours'
      AND work_date BETWEEN v_run.period_start_date AND v_end_date
      AND status IN ('pending', 'approved') AND deleted_at IS NULL;
    v_leave_hours_deduct := ROUND(((v_emp.base_pay_amount / 30.0) / 8.0) * v_leave_hours, 2);

  -- === CASE 2: Part-Time ===
  ELSIF v_emp.type_code = 'part_time' THEN
    SELECT COALESCE(SUM(w.total_hours), 0) INTO v_pt_hours
    FROM worklog_pt w
    WHERE w.employee_id = v_emp.id
      AND w.work_date BETWEEN v_run.period_start_date AND v_end_date
      AND w.status IN ('pending', 'approved') AND w.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM payout_pt_item pi
        JOIN payout_pt p ON p.id = pi.payout_id
        WHERE pi.worklog_id = w.id
          AND pi.deleted_at IS NULL
          AND p.deleted_at IS NULL
          AND p.status = 'paid'
      );
      
    v_ft_salary := ROUND(v_pt_hours * v_emp.base_pay_amount, 2);
  END IF;

  -- SSO amount for this run
  v_sso_base := 0; v_sso_amount := 0;
  IF v_emp.sso_contribute THEN
    IF v_emp.type_code = 'full_time' THEN
      v_sso_base := v_emp.sso_declared_wage;
    ELSE
      v_sso_base := LEAST(v_ft_salary, v_sso_cap);
    END IF;
    v_sso_base := LEAST(COALESCE(v_sso_base, 0), v_sso_cap);
    v_sso_amount := ROUND(v_sso_base * v_run.social_security_rate_employee, 2);
  END IF;

  -- Provident fund deduction for this run
  v_pf_amount := 0;
  IF v_emp.provident_fund_contribute THEN
    v_pf_amount := ROUND(COALESCE(v_ft_salary, 0) * COALESCE(v_emp.provident_fund_rate_employee, 0), 2);
  END IF;

  -- 4. การเงินอื่นๆ (Common)
  -- Salary Advance
  SELECT COALESCE(SUM(amount), 0) INTO v_adv
  FROM salary_advance
  WHERE employee_id = v_emp.id AND payroll_month_date = v_run.payroll_month_date 
    AND status = 'pending' AND deleted_at IS NULL;

  -- Debt Installments
  SELECT jsonb_agg(jsonb_build_object('txn_id', id, 'amount', amount, 'reason', 'Installment')), COALESCE(SUM(amount), 0)
  INTO v_loan_repay_json, v_loan_total
  FROM debt_txn
  WHERE employee_id = v_emp.id AND txn_type = 'installment' 
    AND payroll_month_date = v_run.payroll_month_date AND status = 'pending' AND deleted_at IS NULL;
  
  IF v_loan_repay_json IS NULL THEN v_loan_repay_json := '[]'::jsonb; END IF;

  -- Bonus
  SELECT COALESCE(SUM(bi.bonus_amount), 0) INTO v_bonus_amt
  FROM bonus_item bi JOIN bonus_cycle bc ON bc.id = bi.cycle_id
  WHERE bi.employee_id = v_emp.id AND bc.payroll_month_date = v_run.payroll_month_date 
    AND bc.status = 'approved' AND bc.deleted_at IS NULL;

  -- ยอดสะสมก่อนหน้านี้
  SELECT COALESCE(amount, 0) INTO v_sso_prev
  FROM payroll_accumulation
  WHERE employee_id = v_emp.id AND accum_type = 'sso' AND accum_year = EXTRACT(YEAR FROM v_run.payroll_month_date);

  SELECT COALESCE(amount, 0) INTO v_tax_prev
  FROM payroll_accumulation
  WHERE employee_id = v_emp.id AND accum_type = 'tax' AND accum_year = EXTRACT(YEAR FROM v_run.payroll_month_date);

  SELECT COALESCE(amount, 0) INTO v_income_prev
  FROM payroll_accumulation
  WHERE employee_id = v_emp.id AND accum_type = 'income' AND accum_year = EXTRACT(YEAR FROM v_run.payroll_month_date);

  SELECT COALESCE(amount, 0) INTO v_pf_prev
  FROM payroll_accumulation
  WHERE employee_id = v_emp.id AND accum_type = 'pf' AND accum_year IS NULL;

  -- Doctor fee allowance keeps any existing value for this run/employee
  IF v_emp.allow_doctor_fee THEN
    SELECT COALESCE(doctor_fee, 0)
      INTO v_doctor_fee
    FROM payroll_run_item
    WHERE run_id = p_run_id AND employee_id = v_emp.id;
  ELSE
    v_doctor_fee := 0;
  END IF;

  -- มิเตอร์รอบก่อน (ใช้ค่าปัจจุบันจากงวดก่อนหน้าที่ approved)
  v_water_prev := NULL; v_electric_prev := NULL;
  SELECT pri.water_meter_curr, pri.electric_meter_curr
    INTO v_water_prev, v_electric_prev
  FROM payroll_run_item pri
  JOIN payroll_run pr ON pr.id = pri.run_id
  WHERE pri.employee_id = v_emp.id
    AND pr.payroll_month_date < v_run.payroll_month_date
    AND pr.status = 'approved'
    AND pr.deleted_at IS NULL
  ORDER BY pr.payroll_month_date DESC
  LIMIT 1;

  -- รายได้รวมใช้คำนวณภาษีหัก ณ ที่จ่าย
  v_income_total :=
      COALESCE(v_ft_salary,0) +
      COALESCE(v_ot_amount,0) +
      CASE WHEN v_emp.type_code='full_time' AND v_emp.allow_housing THEN v_config.housing_allowance ELSE 0 END +
      CASE
        WHEN v_emp.type_code='full_time' AND v_ft_salary > 0 AND v_late_deduct = 0
          THEN v_config.attendance_bonus_no_late
        ELSE 0
      END +
      CASE
        WHEN v_emp.type_code='full_time' AND v_ft_salary > 0
             AND v_leave_deduct = 0 AND v_leave_double_deduct = 0 AND v_leave_hours_deduct = 0
          THEN v_config.attendance_bonus_no_leave
        ELSE 0
      END +
      COALESCE(v_bonus_amt,0) +
      COALESCE(v_doctor_fee,0) +
      COALESCE(jsonb_sum_value(v_others_income),0);

  v_tax_month := calculate_withholding_tax(
    v_income_total,
    v_emp.withhold_tax,
    v_emp.sso_contribute,
    v_run.social_security_rate_employee,
    v_sso_cap,
    v_sso_base,
    v_config.tax_apply_standard_expense,
    v_config.tax_standard_expense_rate,
    v_config.tax_standard_expense_cap,
    v_config.tax_apply_personal_allowance,
    v_config.tax_personal_allowance_amount,
    v_config.tax_progressive_brackets,
    v_config.withholding_tax_rate_service
  );

  -- 5. UPDATE ลงตาราง
  UPDATE payroll_run_item
  SET 
    employee_type_id = v_emp.employee_type_id,
    employee_type_name = v_emp.employee_type_name,
    department_name = v_emp.department_name,
    position_name = v_emp.position_name,
    bank_name = v_emp.bank_name,
    bank_account_no = v_emp.bank_account_no,
    salary_amount = v_ft_salary,
    pt_hours_worked = CASE WHEN v_emp.type_code='part_time' THEN v_pt_hours ELSE 0 END,
    pt_hourly_rate = CASE WHEN v_emp.type_code='part_time' THEN v_emp.base_pay_amount ELSE 0 END,
    ot_hours = v_ot_hours,
    ot_amount = v_ot_amount,
    bonus_amount = v_bonus_amt,
    
    housing_allowance = CASE WHEN v_emp.type_code='full_time' AND v_emp.allow_housing THEN v_config.housing_allowance ELSE 0 END,
    attendance_bonus_nolate = CASE
      WHEN v_emp.type_code='full_time' AND v_ft_salary > 0 AND v_late_deduct = 0
        THEN v_config.attendance_bonus_no_late
      ELSE 0
    END,
    attendance_bonus_noleave = CASE
      WHEN v_emp.type_code='full_time' AND v_ft_salary > 0
           AND v_leave_deduct = 0 AND v_leave_double_deduct = 0 AND v_leave_hours_deduct = 0
        THEN v_config.attendance_bonus_no_leave
      ELSE 0
    END,
    
    late_minutes_qty = v_late_mins,
    late_minutes_deduction = v_late_deduct,
    leave_days_qty = v_leave_days,
    leave_days_deduction = v_leave_deduct,
    leave_double_qty = v_leave_double_days,
    leave_double_deduction = v_leave_double_deduct,
    leave_hours_qty = v_leave_hours,
    leave_hours_deduction = v_leave_hours_deduct,
    
    advance_amount = v_adv,
    loan_repayments = v_loan_repay_json,
    doctor_fee = v_doctor_fee,
    others_income = v_others_income,
    others_deduction = v_others_deduction,
    
    sso_declared_wage = v_sso_base,
    sso_month_amount = v_sso_amount,
    sso_accum_prev = COALESCE(v_sso_prev,0),
    tax_accum_prev = COALESCE(v_tax_prev,0),
    tax_month_amount = v_tax_month,
    income_accum_prev = COALESCE(v_income_prev,0),
    pf_accum_prev = COALESCE(v_pf_prev,0),
    pf_month_amount = v_pf_amount,
    water_rate_per_unit = v_config.water_rate_per_unit,
    electricity_rate_per_unit = v_config.electricity_rate_per_unit,
    internet_amount = CASE WHEN v_emp.allow_internet THEN v_config.internet_fee_monthly ELSE 0 END,
    water_meter_prev = COALESCE(v_water_prev, water_meter_prev),
    electric_meter_prev = COALESCE(v_electric_prev, electric_meter_prev),
      
    updated_at = now()
  WHERE run_id = p_run_id AND employee_id = p_employee_id;

END;
$$ LANGUAGE plpgsql;

--- 2. สร้าง Triggers สำหรับแต่ละตาราง
---  2.1 เมื่อมีการแก้ไขข้อมูลพนักงาน (Employees) อัปเดตเมื่อมีการแก้เงินเดือน (`base_pay_amount`) หรือการตั้งค่ากองทุน

CREATE OR REPLACE FUNCTION public.sync_payroll_on_employee_change() RETURNS trigger AS $$
DECLARE
  r_run RECORD;
BEGIN
  -- หา Payroll Run ที่ยัง Pending อยู่
  FOR r_run IN 
    SELECT id FROM payroll_run WHERE status = 'pending' AND deleted_at IS NULL
  LOOP
    -- สั่งคำนวณใหม่เฉพาะพนักงานคนนี้
    PERFORM recalculate_payroll_item(r_run.id, NEW.id);
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_sync_payroll_emp
AFTER UPDATE OF base_pay_amount, sso_contribute, sso_declared_wage,
  allow_housing, allow_internet,
  provident_fund_contribute, provident_fund_rate_employee, provident_fund_rate_employer,
  department_id, position_id, bank_name, bank_account_no, employee_type_id
ON employees
FOR EACH ROW
EXECUTE FUNCTION sync_payroll_on_employee_change();

---  2.2 เมื่อมีการแก้ไข Worklog (FT & PT) อัปเดตเมื่อมีการเพิ่ม/ลบ/แก้ วันลาหรือเวลาทำงาน โดยเช็คช่วงวันที่ให้ตรงงวด
CREATE OR REPLACE FUNCTION public.sync_payroll_on_worklog_change() RETURNS trigger AS $$
DECLARE
  r_run RECORD;
  v_emp_id UUID;
  v_date DATE;
  v_end_date DATE;
BEGIN
  v_emp_id := COALESCE(NEW.employee_id, OLD.employee_id);
  v_date := COALESCE(NEW.work_date, OLD.work_date);

  -- หา Payroll Run ที่ช่วงวันที่ครอบคลุม work_date และยัง Pending
  FOR r_run IN 
    SELECT id, payroll_month_date, period_start_date 
    FROM payroll_run 
    WHERE status = 'pending' AND deleted_at IS NULL
  LOOP
    v_end_date := (r_run.payroll_month_date + interval '1 month' - interval '1 day')::date;
    
    IF v_date >= r_run.period_start_date AND v_date <= v_end_date THEN
      PERFORM recalculate_payroll_item(r_run.id, v_emp_id);
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger สำหรับ Worklog FT
CREATE TRIGGER tg_sync_payroll_worklog_ft
AFTER INSERT OR UPDATE OR DELETE ON worklog_ft
FOR EACH ROW EXECUTE FUNCTION sync_payroll_on_worklog_change();

-- Trigger สำหรับ Worklog PT
CREATE TRIGGER tg_sync_payroll_worklog_pt
AFTER INSERT OR UPDATE OR DELETE ON worklog_pt
FOR EACH ROW EXECUTE FUNCTION sync_payroll_on_worklog_change();

---  2.3 เมื่อมีการแก้ไขการเงิน (Advance, Debt, Bonus) อัปเดตเมื่อยอดหนี้ หรือโบนัสเปลี่ยน
CREATE OR REPLACE FUNCTION public.sync_payroll_on_financial_change() RETURNS trigger AS $$
DECLARE
  r_run RECORD;
  v_emp_id UUID;
  v_target_month DATE;
  v_txn_type TEXT; -- ใช้เฉพาะ debt_txn
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_emp_id := OLD.employee_id;
  ELSE
    v_emp_id := NEW.employee_id;
  END IF;
  
  -- กำหนด Target Month ตามตาราง
  IF TG_TABLE_NAME = 'bonus_item' THEN
    -- ต้อง join ไปหา cycle เพื่อดูเดือน
    SELECT payroll_month_date
      INTO v_target_month 
    FROM bonus_cycle 
    WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.cycle_id ELSE NEW.cycle_id END;

  ELSIF TG_TABLE_NAME = 'debt_txn' THEN
    v_txn_type := CASE WHEN TG_OP = 'DELETE' THEN OLD.txn_type ELSE NEW.txn_type END;
    v_target_month := CASE WHEN TG_OP = 'DELETE' THEN OLD.payroll_month_date ELSE NEW.payroll_month_date END;

  ELSE
    -- salary_advance (และตารางอื่นในอนาคต) มี payroll_month_date แต่ไม่มี txn_type
    v_target_month := CASE WHEN TG_OP = 'DELETE' THEN OLD.payroll_month_date ELSE NEW.payroll_month_date END;
  END IF;

  -- ถ้าเป็น debt_txn แต่ไม่ใช่ installment ให้ข้าม
  IF TG_TABLE_NAME = 'debt_txn' AND v_txn_type <> 'installment' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF v_target_month IS NOT NULL THEN
    -- หา Run ที่เดือนตรงกันและ Pending
    FOR r_run IN 
      SELECT id FROM payroll_run 
      WHERE payroll_month_date = v_target_month 
        AND status = 'pending' AND deleted_at IS NULL
      LOOP
        PERFORM recalculate_payroll_item(r_run.id, v_emp_id);
      END LOOP;
    END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Advance
CREATE TRIGGER tg_sync_payroll_advance
AFTER INSERT OR UPDATE OR DELETE ON salary_advance
FOR EACH ROW EXECUTE FUNCTION sync_payroll_on_financial_change();

-- Debt (Installment Only)
CREATE TRIGGER tg_sync_payroll_debt
AFTER INSERT OR UPDATE OR DELETE ON debt_txn
FOR EACH ROW EXECUTE FUNCTION sync_payroll_on_financial_change();

-- Bonus Item
CREATE TRIGGER tg_sync_payroll_bonus
AFTER UPDATE OF bonus_amount ON bonus_item
FOR EACH ROW EXECUTE FUNCTION sync_payroll_on_financial_change();

---  2.5 เมื่อมีการแก้ไข payroll_accumulation ให้คำนวณยอด prev ใหม่ในงวดที่ยัง Pending
CREATE OR REPLACE FUNCTION public.sync_payroll_on_accum_change() RETURNS trigger AS $$
DECLARE
  r_run RECORD;
  v_emp_id UUID;
  v_type TEXT;
  v_year INT;
BEGIN
  v_emp_id := COALESCE(NEW.employee_id, OLD.employee_id);
  v_type := COALESCE(NEW.accum_type, OLD.accum_type);
  v_year := COALESCE(NEW.accum_year, OLD.accum_year);

  IF v_emp_id IS NULL OR v_type IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  FOR r_run IN
    SELECT id, payroll_month_date
    FROM payroll_run
    WHERE status = 'pending'
      AND deleted_at IS NULL
      AND (
        (v_type IN ('sso', 'sso_employer', 'tax', 'income') AND v_year IS NOT NULL AND EXTRACT(YEAR FROM payroll_month_date) = v_year)
        OR
        (v_type IN ('pf', 'pf_employer', 'loan_outstanding') AND v_year IS NULL)
      )
  LOOP
    PERFORM recalculate_payroll_item(r_run.id, v_emp_id);
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_sync_payroll_accum_change ON payroll_accumulation;
CREATE TRIGGER tg_sync_payroll_accum_change
AFTER INSERT OR UPDATE OR DELETE ON payroll_accumulation
FOR EACH ROW EXECUTE FUNCTION sync_payroll_on_accum_change();

---  2.4 เมื่อ payout_pt ถูกจ่าย ให้ตัดชั่วโมงออกจาก payroll pending
CREATE OR REPLACE FUNCTION public.sync_payroll_on_payout_pt_paid() RETURNS trigger AS $$
DECLARE
  r_target RECORD;
BEGIN
  IF NEW.status = 'paid' AND OLD.status <> 'paid' THEN
    FOR r_target IN
      SELECT DISTINCT pr.id AS run_id, w.employee_id
      FROM payout_pt_item pi
      JOIN worklog_pt w ON w.id = pi.worklog_id
      JOIN payroll_run pr ON pr.status = 'pending'
        AND pr.deleted_at IS NULL
        AND w.work_date BETWEEN pr.period_start_date AND (pr.payroll_month_date + interval '1 month' - interval '1 day')::date
      WHERE pi.payout_id = NEW.id
        AND pi.deleted_at IS NULL
        AND w.deleted_at IS NULL
    LOOP
      PERFORM recalculate_payroll_item(r_target.run_id, r_target.employee_id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_sync_payroll_payout_pt_paid ON payout_pt;
CREATE TRIGGER tg_sync_payroll_payout_pt_paid
AFTER UPDATE ON payout_pt
FOR EACH ROW EXECUTE FUNCTION sync_payroll_on_payout_pt_paid();

--- ====================================================
--- Trigger สำหรับ Payroll Config
--- Scope: เมื่อ Config เปลี่ยน มันกระทบ "ทุกคน" ในงวดนั้น (Global Impact) ไม่ใช่แค่คนใดคนหนึ่ง
--- Action: เราต้องวนลูปสั่ง recalculate_payroll_item ให้กับพนักงานทุกคนใน payroll_run ที่ยัง Pending อยู่
--- ====================================================
CREATE OR REPLACE FUNCTION public.sync_payroll_on_config_change() RETURNS trigger AS $$
DECLARE
  r_run RECORD;
  r_item RECORD;
  v_config_start DATE;
  v_config_end DATE;
BEGIN
  -- ทำงานเฉพาะ config ที่ยัง active; ข้ามการ update ที่เปลี่ยนสถานะเป็น retired
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  -- ดึงช่วงเวลาของ Config ที่เพิ่งถูกเพิ่ม/แก้ไข
  -- (ใช้ lower/upper bound ของ daterange)
  v_config_start := lower(NEW.effective_daterange);
  
  -- กรณี upper เป็น infinity ให้ใช้วันที่ไกลๆ แทน เพื่อให้ logic เปรียบเทียบทำงานได้
  IF upper_inf(NEW.effective_daterange) THEN
    v_config_end := '9999-12-31'::date;
  ELSE
    v_config_end := upper(NEW.effective_daterange) - interval '1 day';
  END IF;

  -- วนหา Payroll Run ที่ยัง Pending อยู่
  FOR r_run IN 
    SELECT id, payroll_month_date 
    FROM payroll_run 
    WHERE status = 'pending' 
      AND deleted_at IS NULL
  LOOP
    -- เช็คว่า Config นี้ "มีผล" กับงวดเดือนนี้หรือไม่ (@> คือ contains)
    -- หรือเช็คแบบง่าย: วันที่ของงวด อยู่ในช่วง Config นี้หรือไม่
    IF NEW.effective_daterange @> r_run.payroll_month_date THEN
      
      -- ถ้าตรงงวด -> ต้องคำนวณใหม่ให้ "ทุกคน" ในงวดนั้น
      -- วนลูปหา Item ทั้งหมดใน Run นี้
      FOR r_item IN 
        SELECT employee_id 
        FROM payroll_run_item 
        WHERE run_id = r_run.id
      LOOP
        -- เรียกฟังก์ชันคำนวณรายคน
        PERFORM recalculate_payroll_item(r_run.id, r_item.employee_id);
      END LOOP;
      
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- สร้าง Trigger ผูกกับตาราง payroll_config
DROP TRIGGER IF EXISTS tg_sync_payroll_config ON public.payroll_config;

CREATE TRIGGER tg_sync_payroll_config
AFTER INSERT OR UPDATE ON payroll_config
FOR EACH ROW
WHEN (NEW.status = 'active')
EXECUTE FUNCTION sync_payroll_on_config_change();

-- When a new employee is created and there are pending payroll runs,
-- add that employee to each pending run and compute their payroll item.
CREATE OR REPLACE FUNCTION public.add_employee_to_pending_payroll_runs()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  r_run RECORD;
BEGIN
  FOR r_run IN
    SELECT id, period_start_date
    FROM payroll_run
    WHERE status = 'pending'
      AND deleted_at IS NULL
  LOOP
    -- Only attach to runs that overlap the employment period (or no end date).
    IF NEW.employment_end_date IS NULL OR NEW.employment_end_date >= r_run.period_start_date THEN
      INSERT INTO payroll_run_item (
        run_id, employee_id, employee_type_id,
        created_by, updated_by
      ) VALUES (
        r_run.id, NEW.id, NEW.employee_type_id,
        NEW.created_by, NEW.created_by
      )
      ON CONFLICT (run_id, employee_id) DO NOTHING;

      -- Calculate payroll figures for the new employee in this run.
      PERFORM recalculate_payroll_item(r_run.id, NEW.id);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_payroll_run_add_new_employee ON employees;
CREATE TRIGGER tg_payroll_run_add_new_employee
AFTER INSERT ON employees
FOR EACH ROW
EXECUTE FUNCTION public.add_employee_to_pending_payroll_runs();
