-- =============================================
-- Banks Master Data and Company Settings
-- =============================================

-- Banks table (System + Company specific)
CREATE TABLE banks (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    code VARCHAR(50) NOT NULL,
    name_th VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    name_my VARCHAR(255) NOT NULL DEFAULT '',
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    company_id UUID REFERENCES companies(id), -- NULL for system banks
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id)
);

-- Unique constraint: code must be unique per company (or system-wide if NULL)
CREATE UNIQUE INDEX banks_code_company_uk
ON banks (lower(code), COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid))
WHERE deleted_at IS NULL;

-- Settings to allow companies to disable system banks
CREATE TABLE company_bank_settings (
    company_id UUID NOT NULL REFERENCES companies(id),
    bank_id UUID NOT NULL REFERENCES banks(id),
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    PRIMARY KEY (company_id, bank_id)
);

-- Seed System Banks
INSERT INTO banks (code, name_th, name_en, is_system) VALUES
('BBL', 'ธนาคารกรุงเทพ', 'Bangkok Bank', TRUE),
('KBANK', 'ธนาคารกสิกรไทย', 'Kasikornbank', TRUE),
('KTB', 'ธนาคารกรุงไทย', 'Krung Thai Bank', TRUE),
('SCB', 'ธนาคารไทยพาณิชย์', 'Siam Commercial Bank', TRUE),
('BAY', 'ธนาคารกรุงศรีอยุธยา', 'Bank of Ayudhya', TRUE),
('TTB', 'ธนาคารทหารไทยธนชาต', 'TMBThanachart Bank', TRUE),
('UOB', 'ธนาคารยูโอบี', 'United Overseas Bank', TRUE),
('CIMBT', 'ธนาคารซีไอเอ็มบีไทย', 'CIMB Thai Bank', TRUE),
('KKP', 'ธนาคารเกียรตินาคินภัทร', 'Kiatnakin Phatra Bank', TRUE),
('LHFG', 'ธนาคารแลนด์ แอนด์ เฮ้าส์', 'Land and Houses Bank', TRUE),
('TISCO', 'ธนาคารทิสโก้', 'TISCO Bank', TRUE),
('GSB', 'ธนาคารออมสิน', 'Government Savings Bank', TRUE),
('BAAC', 'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร', 'Bank for Agriculture and Agricultural Cooperatives', TRUE),
('GHB', 'ธนาคารอาคารสงเคราะห์', 'Government Housing Bank', TRUE);

-- updated_at trigger
CREATE TRIGGER tg_banks_set_updated
BEFORE UPDATE ON banks
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- =============================================
-- Drop dependent views and triggers BEFORE altering employees
-- =============================================
DROP VIEW IF EXISTS v_employees_active_enriched CASCADE;
DROP VIEW IF EXISTS v_employees_active CASCADE;

-- Drop the trigger that references bank_name column
DROP TRIGGER IF EXISTS tg_sync_payroll_emp ON employees;

-- =============================================
-- Alter employees table: replace bank_name with bank_id
-- =============================================
ALTER TABLE employees
DROP CONSTRAINT IF EXISTS employees_bank_pair;

ALTER TABLE employees
DROP COLUMN IF EXISTS bank_name,
ADD COLUMN bank_id UUID REFERENCES banks(id);

-- =============================================
-- Recreate views with bank_id instead of bank_name
-- =============================================
CREATE OR REPLACE VIEW v_employees_active AS
SELECT
  e.*
FROM employees e
WHERE e.employment_end_date IS NULL
  AND e.deleted_at IS NULL
WITH LOCAL CHECK OPTION;

CREATE OR REPLACE VIEW v_employees_active_enriched AS
SELECT
  e.id AS employee_id,
  e.employee_number,
  e.company_id,
  e.branch_id,
  pt.code AS title_code, pt.name_th AS title_name_th,
  e.first_name, e.last_name,
  e.nickname,
  (pt.name_th || e.first_name || ' ' || e.last_name || COALESCE(' (' || e.nickname || ')', '')) AS full_name_th,
  idt.code AS id_document_type_code, idt.name_th AS id_document_type_name_th,
  e.id_document_number,
  e.id_document_other_description,
  e.phone, e.email,
  e.photo_id,
  et.code AS employee_type_code, et.name_th AS employee_type_name_th,
  d.id AS department_id, d.code AS department_code, d.name_th AS department_name_th,
  ep.id AS position_id, ep.code AS position_code, ep.name_th AS position_name_th,
  e.base_pay_amount,
  CASE et.code
    WHEN 'full_time' THEN 'monthly'
    WHEN 'part_time' THEN 'hourly'
    ELSE 'unknown'
  END AS pay_basis,
  CASE et.code
    WHEN 'full_time' THEN 'บาท/เดือน'
    WHEN 'part_time' THEN 'บาท/ชั่วโมง'
    ELSE NULL
  END AS pay_unit_th,
  e.employment_start_date,
  e.bank_id, b.name_th AS bank_name, e.bank_account_no,
  e.sso_contribute, e.sso_declared_wage,
  e.sso_hospital_name,
  e.provident_fund_contribute, e.provident_fund_rate_employee, e.provident_fund_rate_employer,
  e.withhold_tax,
  e.allow_housing, e.allow_water, e.allow_electric, e.allow_internet,
  e.allow_doctor_fee, e.allow_attendance_bonus_nolate, e.allow_attendance_bonus_noleave,
  e.created_at, e.created_by, e.updated_at, e.updated_by
FROM employees e
JOIN person_title      pt  ON pt.id  = e.title_id
JOIN id_document_type  idt ON idt.id = e.id_document_type_id
JOIN employee_type     et  ON et.id  = e.employee_type_id
LEFT JOIN department   d   ON d.id   = e.department_id
LEFT JOIN employee_position ep ON ep.id = e.position_id
LEFT JOIN banks        b   ON b.id   = e.bank_id
WHERE e.employment_end_date IS NULL
  AND e.deleted_at IS NULL;

-- =============================================
-- Recreate trigger with bank_id instead of bank_name
-- =============================================
CREATE TRIGGER tg_sync_payroll_emp
AFTER UPDATE OF base_pay_amount, sso_contribute, sso_declared_wage, withhold_tax,
  allow_housing, allow_water, allow_electric, allow_internet, allow_doctor_fee,
  allow_attendance_bonus_nolate, allow_attendance_bonus_noleave,
  provident_fund_contribute, provident_fund_rate_employee, provident_fund_rate_employer,
  department_id, position_id, bank_id, bank_account_no, employee_type_id,
  employment_end_date, deleted_at, company_id, branch_id
ON employees
FOR EACH ROW
EXECUTE FUNCTION sync_payroll_on_employee_change();

-- =============================================
-- Alter debt_txn table: add bank_id for repayment
-- =============================================
ALTER TABLE debt_txn
ADD COLUMN IF NOT EXISTS bank_id UUID REFERENCES banks(id);


-- =============================================
-- Update payroll_run_generate_items to JOIN banks table
-- =============================================
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
  v_sso_cap NUMERIC(14,2) := 17500.00;
  v_sso_base NUMERIC(14,2) := 0;
  v_sso_amount NUMERIC(14,2) := 0;
  v_tax_prev NUMERIC(14,2) := 0;
  v_income_prev NUMERIC(14,2) := 0;
  v_pf_prev  NUMERIC(14,2) := 0;
  v_loan_prev NUMERIC(14,2) := 0;
  v_pf_amount NUMERIC(14,2) := 0;
  v_water_prev NUMERIC(12,2);
  v_electric_prev NUMERIC(12,2);
  v_income_total NUMERIC(14,2) := 0;
  v_tax_month NUMERIC(14,2) := 0;
  
  -- ตัวแปรสำหรับ Part-time
  v_pt_hours NUMERIC(10,2);
  
  -- Snapshot
  v_settings_snapshot JSONB;

BEGIN
  -- 1. หา Config ที่ตรงกับเดือนที่จ่าย (scoped to company)
  SELECT *
  INTO v_config
  FROM payroll_config pc
  WHERE pc.company_id = NEW.company_id
    AND pc.effective_daterange @> NEW.payroll_month_date
  ORDER BY lower(pc.effective_daterange) DESC, pc.version_no DESC
  LIMIT 1;

  IF v_config IS NULL THEN
    RAISE EXCEPTION 'ไม่พบ Payroll Config สำหรับงวดวันที่ %', NEW.payroll_month_date;
  END IF;

  -- [UPDATE] Save payroll_config_id to payroll_run for audit/snapshot
  UPDATE payroll_run
  SET payroll_config_id = v_config.id
  WHERE id = NEW.id;

  -- คำนวณวันสิ้นงวด
  v_end_date := (NEW.payroll_month_date + interval '1 month' - interval '1 day')::date;
  v_sso_cap := LEAST(COALESCE(v_config.social_security_wage_cap, 17500.00), 17500.00);

  -- 2. วนลูปพนักงานทุกคนที่ Active ใน company/branch เดียวกัน
  -- JOIN banks table to get bank_name
  FOR v_emp IN 
    SELECT e.*, t.code as type_code, t.name_th AS employee_type_name,
           d.name_th AS department_name, ep.name_th AS position_name,
           b.name_th AS bank_name
    FROM employees e
    JOIN employee_type t ON t.id = e.employee_type_id
    LEFT JOIN department d ON d.id = e.department_id
    LEFT JOIN employee_position ep ON ep.id = e.position_id
    LEFT JOIN banks b ON b.id = e.bank_id
    WHERE e.deleted_at IS NULL
      AND (e.employment_end_date IS NULL OR e.employment_end_date >= NEW.period_start_date)
      AND e.company_id = NEW.company_id
      AND e.branch_id = NEW.branch_id
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

    -- [NEW] Prepared Snapshot
    v_settings_snapshot := jsonb_build_object(
      'base_pay_amount', v_emp.base_pay_amount,
      'sso_contribute', v_emp.sso_contribute,
      'provident_fund_contribute', v_emp.provident_fund_contribute,
      'withhold_tax', v_emp.withhold_tax,
      'allow_housing', v_emp.allow_housing,
      'allow_water', v_emp.allow_water,
      'allow_electric', v_emp.allow_electric,
      'allow_internet', v_emp.allow_internet,
      'allow_doctor_fee', v_emp.allow_doctor_fee,
      'allow_attendance_bonus_nolate', v_emp.allow_attendance_bonus_nolate,
      'allow_attendance_bonus_noleave', v_emp.allow_attendance_bonus_noleave
    );

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
        AND status = 'pending' AND deleted_at IS NULL;
      
      v_ot_amount := v_ot_hours * v_config.ot_hourly_rate;

      -- C. คำนวณรายการหัก (Deductions)
      
      -- 1) มาสาย (Late)
      SELECT COALESCE(SUM(quantity), 0) INTO v_late_mins
      FROM worklog_ft 
      WHERE employee_id = v_emp.id AND entry_type = 'late'
        AND work_date BETWEEN NEW.period_start_date AND v_end_date
        AND status = 'pending' AND deleted_at IS NULL;
      
      IF v_late_mins > COALESCE(v_config.late_grace_minutes, 15) THEN
        v_late_deduct := v_late_mins * COALESCE(v_config.late_rate_per_minute, 5);
      ELSE
        v_late_deduct := 0;
      END IF;

      -- 2) ลา (Leave Day)
      SELECT COALESCE(SUM(quantity), 0) INTO v_leave_days
      FROM worklog_ft 
      WHERE employee_id = v_emp.id AND entry_type = 'leave_day'
        AND work_date BETWEEN NEW.period_start_date AND v_end_date
        AND status = 'pending' AND deleted_at IS NULL;
      
      v_leave_deduct := ROUND((v_emp.base_pay_amount / 30.0) * v_leave_days, 2);

      -- 3) ลาหัก 2 เท่า (Leave Double)
      SELECT COALESCE(SUM(quantity), 0) INTO v_leave_double_days
      FROM worklog_ft 
      WHERE employee_id = v_emp.id AND entry_type = 'leave_double'
        AND work_date BETWEEN NEW.period_start_date AND v_end_date
        AND status = 'pending' AND deleted_at IS NULL;
      
      v_leave_double_deduct := ROUND(((v_emp.base_pay_amount / 30.0) * 2) * v_leave_double_days, 2);

      -- 4) ลารายชั่วโมง (Leave Hours)
      SELECT COALESCE(SUM(quantity), 0) INTO v_leave_hours
      FROM worklog_ft 
      WHERE employee_id = v_emp.id AND entry_type = 'leave_hours'
        AND work_date BETWEEN NEW.period_start_date AND v_end_date
        AND status = 'pending' AND deleted_at IS NULL;
      
      v_leave_hours_deduct := ROUND(((v_emp.base_pay_amount / 30.0) / COALESCE(v_config.work_hours_per_day, 8.0)) * v_leave_hours, 2);

      -- D. การเงินอื่นๆ (Advance, Debt, Bonus)
      SELECT COALESCE(SUM(amount), 0) INTO v_adv
      FROM salary_advance
      WHERE employee_id = v_emp.id AND payroll_month_date = NEW.payroll_month_date AND status = 'pending' AND deleted_at IS NULL;

      SELECT jsonb_agg(jsonb_build_object('txn_id', id, 'value', amount, 'name', 'ผ่อนชำระงวด ' || TO_CHAR(payroll_month_date, 'MM/YYYY'))), COALESCE(SUM(amount), 0)
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
      SELECT COALESCE(SUM(w.total_hours), 0) INTO v_pt_hours
      FROM worklog_pt w
      WHERE w.employee_id = v_emp.id
        AND w.work_date BETWEEN NEW.period_start_date AND v_end_date
        AND w.status = 'pending'
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

      v_ft_salary := ROUND(v_pt_hours * v_emp.base_pay_amount, 2);
      
    END IF;

    -- ดึงยอดสะสม
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

    -- SSO
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

    -- Provident fund
    v_pf_amount := 0;
    IF v_emp.provident_fund_contribute THEN
      v_pf_amount := ROUND(COALESCE(v_ft_salary, 0) * COALESCE(v_emp.provident_fund_rate_employee, 0), 2);
    END IF;

    -- Doctor fee
    IF v_emp.allow_doctor_fee THEN
      v_doctor_fee := 0;
    END IF;

    -- รายได้รวมเพื่อคำนวณภาษี
    v_income_total :=
        COALESCE(v_ft_salary,0) +
        COALESCE(v_ot_amount,0) +
        CASE WHEN v_emp.type_code = 'full_time' AND v_emp.allow_housing THEN v_config.housing_allowance ELSE 0 END +
        CASE
          WHEN v_emp.type_code = 'full_time' AND v_ft_salary > 0 AND v_late_mins = 0 AND v_emp.allow_attendance_bonus_nolate
            THEN v_config.attendance_bonus_no_late
          ELSE 0
        END +
        CASE
          WHEN v_emp.type_code = 'full_time' AND v_ft_salary > 0
               AND v_leave_deduct = 0 AND v_leave_double_deduct = 0 AND v_leave_hours_deduct = 0 AND v_emp.allow_attendance_bonus_noleave
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
    -- 3. INSERT ลงตาราง payroll_run_item with company_id and branch_id
    -- ============================================================
    INSERT INTO payroll_run_item (
      run_id, employee_id, company_id, branch_id, employee_type_id, employee_type_name,
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
      employee_settings_snapshot,
      created_by, updated_by
    )
    VALUES (
      NEW.id, v_emp.id, NEW.company_id, NEW.branch_id, v_emp.employee_type_id, v_emp.employee_type_name,
      v_emp.department_name, v_emp.position_name, v_emp.bank_name, v_emp.bank_account_no,
      v_ft_salary,
      CASE WHEN v_emp.type_code = 'part_time' THEN v_pt_hours ELSE 0 END,
      CASE WHEN v_emp.type_code = 'part_time' THEN v_emp.base_pay_amount ELSE 0 END,
      v_ot_hours, v_ot_amount, v_bonus_amt,
      
      CASE WHEN v_emp.type_code = 'full_time' AND v_emp.allow_housing THEN v_config.housing_allowance ELSE 0 END,
      CASE
        WHEN v_emp.type_code = 'full_time' AND v_ft_salary > 0 AND v_late_mins = 0 AND v_emp.allow_attendance_bonus_nolate
          THEN v_config.attendance_bonus_no_late
        ELSE 0
      END,
      CASE
        WHEN v_emp.type_code = 'full_time' AND v_ft_salary > 0
             AND v_leave_deduct = 0 AND v_leave_double_deduct = 0 AND v_leave_hours_deduct = 0 AND v_emp.allow_attendance_bonus_noleave
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
      
      v_sso_base, v_sso_amount,
      COALESCE(v_sso_prev,0),
      COALESCE(v_tax_prev,0), v_tax_month, COALESCE(v_pf_prev,0), v_pf_amount,
      v_doctor_fee, v_others_income, v_others_deduction,
      v_water_prev, NULL, v_config.water_rate_per_unit, 0,
      v_electric_prev, NULL, v_config.electricity_rate_per_unit, 0,
      CASE WHEN v_emp.allow_internet THEN v_config.internet_fee_monthly ELSE 0 END,
      v_settings_snapshot,
      
      NEW.created_by, NEW.created_by
    );
    
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================
-- Update recalculate_payroll_item to JOIN banks table
-- =============================================
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
  v_sso_cap NUMERIC(14,2) := 17500.00;
  v_sso_base NUMERIC(14,2) := 0;
  v_sso_amount NUMERIC(14,2) := 0;
  v_tax_prev NUMERIC(14,2) := 0;
  v_income_prev NUMERIC(14,2) := 0;
  v_pf_prev  NUMERIC(14,2) := 0;
  v_loan_prev NUMERIC(14,2) := 0;
  v_pf_amount NUMERIC(14,2) := 0;
  v_water_prev NUMERIC(12,2);
  v_electric_prev NUMERIC(12,2);
  v_income_total NUMERIC(14,2) := 0;
  v_tax_month NUMERIC(14,2) := 0;
  
  v_settings_snapshot JSONB;

BEGIN
  -- 1. ดึงข้อมูล Payroll Run และ Config
  SELECT * INTO v_run FROM payroll_run WHERE id = p_run_id;
  IF NOT FOUND OR v_run.status <> 'pending' THEN
    RETURN;
  END IF;

  -- JOIN banks table to get bank_name
  SELECT e.*, t.code as type_code, t.name_th AS employee_type_name,
         d.name_th AS department_name, ep.name_th AS position_name,
         b.name_th AS bank_name
  INTO v_emp
  FROM employees e
  JOIN employee_type t ON t.id = e.employee_type_id
  LEFT JOIN department d ON d.id = e.department_id
  LEFT JOIN employee_position ep ON ep.id = e.position_id
  LEFT JOIN banks b ON b.id = e.bank_id
  WHERE e.id = p_employee_id;

  -- ถ้าหาไม่เจอ (hard delete) ให้ลบ item ออกจากงวดนี้แล้วหยุด
  IF v_emp IS NULL THEN
    DELETE FROM payroll_run_item
    WHERE run_id = p_run_id AND employee_id = p_employee_id;
    RETURN;
  END IF;
  IF v_emp.company_id IS DISTINCT FROM v_run.company_id THEN RETURN; END IF;
  IF v_emp.branch_id IS DISTINCT FROM v_run.branch_id THEN RETURN; END IF;

  -- ถ้าพนักงานถูกลบ หรือสิ้นสุดการจ้างก่อนวันเริ่มงวด ให้ลบ item ออกแล้วหยุด
  IF v_emp.deleted_at IS NOT NULL
     OR (v_emp.employment_end_date IS NOT NULL AND v_emp.employment_end_date < v_run.period_start_date) THEN
    DELETE FROM payroll_run_item
    WHERE run_id = p_run_id AND employee_id = p_employee_id
      AND company_id = v_run.company_id
      AND branch_id = v_run.branch_id;
    RETURN;
  END IF;

  -- [UPDATE] Use payroll_config_id from payroll_run if available
  IF v_run.payroll_config_id IS NOT NULL THEN
    SELECT * INTO v_config FROM payroll_config WHERE id = v_run.payroll_config_id;
  ELSE
    SELECT *
    INTO v_config
    FROM payroll_config pc
    WHERE pc.company_id = v_run.company_id
      AND pc.effective_daterange @> v_run.payroll_month_date
    ORDER BY lower(pc.effective_daterange) DESC, pc.version_no DESC
    LIMIT 1;
  END IF;

  IF v_config IS NULL THEN
    RETURN;
  END IF;

  v_end_date := (v_run.payroll_month_date + interval '1 month' - interval '1 day')::date;
  v_sso_cap := LEAST(COALESCE(v_config.social_security_wage_cap, 17500.00), 17500.00);

  -- [Snapshot]
  v_settings_snapshot := jsonb_build_object(
    'base_pay_amount', v_emp.base_pay_amount,
    'sso_contribute', v_emp.sso_contribute,
    'provident_fund_contribute', v_emp.provident_fund_contribute,
    'withhold_tax', v_emp.withhold_tax,
    'allow_housing', v_emp.allow_housing,
    'allow_water', v_emp.allow_water,
    'allow_electric', v_emp.allow_electric,
    'allow_internet', v_emp.allow_internet,
    'allow_doctor_fee', v_emp.allow_doctor_fee,
    'allow_attendance_bonus_nolate', v_emp.allow_attendance_bonus_nolate,
    'allow_attendance_bonus_noleave', v_emp.allow_attendance_bonus_noleave
  );

  -- 3. คำนวณตามสูตร (Logic เดียวกับ payroll_run_generate_items)
  
  -- === CASE 1: Full-Time ===
  IF v_emp.type_code = 'full_time' THEN
    v_ft_salary := v_emp.base_pay_amount;

    -- OT
    SELECT COALESCE(SUM(quantity), 0) INTO v_ot_hours
    FROM worklog_ft 
    WHERE employee_id = v_emp.id AND entry_type = 'ot' 
      AND work_date BETWEEN v_run.period_start_date AND v_end_date
      AND status = 'pending' AND deleted_at IS NULL;
    v_ot_amount := v_ot_hours * v_config.ot_hourly_rate;

    -- Late
    SELECT COALESCE(SUM(quantity), 0) INTO v_late_mins
    FROM worklog_ft 
    WHERE employee_id = v_emp.id AND entry_type = 'late'
      AND work_date BETWEEN v_run.period_start_date AND v_end_date
      AND status = 'pending' AND deleted_at IS NULL;
    
    IF v_late_mins > COALESCE(v_config.late_grace_minutes, 15) THEN
      v_late_deduct := v_late_mins * COALESCE(v_config.late_rate_per_minute, 5);
    END IF;

    -- Leave (Days)
    SELECT COALESCE(SUM(quantity), 0) INTO v_leave_days
    FROM worklog_ft 
    WHERE employee_id = v_emp.id AND entry_type = 'leave_day'
      AND work_date BETWEEN v_run.period_start_date AND v_end_date
      AND status = 'pending' AND deleted_at IS NULL;
    v_leave_deduct := ROUND((v_emp.base_pay_amount / 30.0) * v_leave_days, 2);

    -- Leave (Double)
    SELECT COALESCE(SUM(quantity), 0) INTO v_leave_double_days
    FROM worklog_ft 
    WHERE employee_id = v_emp.id AND entry_type = 'leave_double'
      AND work_date BETWEEN v_run.period_start_date AND v_end_date
      AND status = 'pending' AND deleted_at IS NULL;
    v_leave_double_deduct := ROUND(((v_emp.base_pay_amount / 30.0) * 2) * v_leave_double_days, 2);

    -- Leave (Hours)
    SELECT COALESCE(SUM(quantity), 0) INTO v_leave_hours
    FROM worklog_ft 
    WHERE employee_id = v_emp.id AND entry_type = 'leave_hours'
      AND work_date BETWEEN v_run.period_start_date AND v_end_date
      AND status = 'pending' AND deleted_at IS NULL;
    v_leave_hours_deduct := ROUND(((v_emp.base_pay_amount / 30.0) / COALESCE(v_config.work_hours_per_day, 8.0)) * v_leave_hours, 2);

  -- === CASE 2: Part-Time ===
  ELSIF v_emp.type_code = 'part_time' THEN
    SELECT COALESCE(SUM(w.total_hours), 0) INTO v_pt_hours
    FROM worklog_pt w
    WHERE w.employee_id = v_emp.id
      AND w.work_date BETWEEN v_run.period_start_date AND v_end_date
      AND w.status = 'pending' AND w.deleted_at IS NULL
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
  SELECT jsonb_agg(jsonb_build_object('txn_id', id, 'value', amount, 'name', 'ผ่อนชำระงวด ' || TO_CHAR(payroll_month_date, 'MM/YYYY'))), COALESCE(SUM(amount), 0)
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

  SELECT COALESCE(amount, 0) INTO v_loan_prev
  FROM payroll_accumulation
  WHERE employee_id = v_emp.id AND company_id = v_run.company_id AND accum_type = 'loan_outstanding';

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
        WHEN v_emp.type_code='full_time' AND v_ft_salary > 0 AND v_late_mins = 0
             AND v_emp.allow_attendance_bonus_nolate
          THEN v_config.attendance_bonus_no_late
        ELSE 0
      END +
      CASE
        WHEN v_emp.type_code='full_time' AND v_ft_salary > 0
             AND v_leave_deduct = 0 AND v_leave_double_deduct = 0 AND v_leave_hours_deduct = 0
             AND v_emp.allow_attendance_bonus_noleave
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
      WHEN v_emp.type_code='full_time' AND v_ft_salary > 0 AND v_late_mins = 0 AND v_emp.allow_attendance_bonus_nolate
        THEN v_config.attendance_bonus_no_late
      ELSE 0
    END,
    attendance_bonus_noleave = CASE
      WHEN v_emp.type_code='full_time' AND v_ft_salary > 0
           AND v_leave_deduct = 0 AND v_leave_double_deduct = 0 AND v_leave_hours_deduct = 0 AND v_emp.allow_attendance_bonus_noleave
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
    loan_outstanding_prev = COALESCE(v_loan_prev,0),
    water_rate_per_unit = v_config.water_rate_per_unit,
    electricity_rate_per_unit = v_config.electricity_rate_per_unit,
    internet_amount = CASE WHEN v_emp.allow_internet THEN v_config.internet_fee_monthly ELSE 0 END,
    water_meter_prev = COALESCE(v_water_prev, water_meter_prev),
    electric_meter_prev = COALESCE(v_electric_prev, electric_meter_prev),
    
    employee_settings_snapshot = v_settings_snapshot,
      
    updated_at = now()
  WHERE run_id = p_run_id AND employee_id = p_employee_id
    AND company_id = v_run.company_id
    AND branch_id = v_run.branch_id;

END;
$$ LANGUAGE plpgsql;
