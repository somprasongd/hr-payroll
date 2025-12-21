-- =========================================
-- Fix: Multi-tenancy for INSERT and Sync Functions
-- 
-- PART 1: Add company_id/branch_id to INSERT functions
-- PART 2: Scope sync/recalculate triggers to tenant
-- =========================================

-- =========================================
-- 1) Fix sync_loan_balance_to_accumulation()
-- Insert to payroll_accumulation requires company_id
-- =========================================
CREATE OR REPLACE FUNCTION public.sync_loan_balance_to_accumulation() RETURNS trigger AS $$
DECLARE
  v_diff NUMERIC(14,2) := 0;
  v_approved_now BOOLEAN := FALSE;
  v_company_id UUID;
BEGIN
  -- ทำงานเฉพาะเมื่อสถานะเป็น 'approved' (ตอน INSERT) หรือเพิ่งเปลี่ยนเป็น 'approved' (ตอน UPDATE)
  IF TG_OP = 'INSERT' THEN
    v_approved_now := (NEW.status = 'approved');
  ELSE
    v_approved_now := (NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved'));
  END IF;

  IF v_approved_now THEN
    
    -- Get company_id from the debt_txn record or from employee
    v_company_id := NEW.company_id;
    IF v_company_id IS NULL THEN
      SELECT company_id INTO v_company_id FROM employees WHERE id = NEW.employee_id;
    END IF;
    
    -- กรณี: อนุมัติเงินกู้/ตั้งหนี้ (ยอดหนี้เพิ่ม +)
    IF NEW.txn_type IN ('loan', 'other') THEN
      v_diff := NEW.amount;
      
    -- กรณี: อนุมัติการคืนเงิน/จ่ายค่างวด (ยอดหนี้ลด -)
    ELSIF NEW.txn_type IN ('repayment', 'installment') THEN
      v_diff := -NEW.amount;
    END IF;

    -- Upsert ลงใน payroll_accumulation with company_id
    INSERT INTO payroll_accumulation (
      employee_id, company_id, accum_type, accum_year, amount, updated_by, updated_at
    )
    VALUES (
      NEW.employee_id, 
      v_company_id,
      'loan_outstanding', 
      NULL,        -- ปีเป็น NULL เสมอ
      v_diff,      -- ค่าเริ่มต้น (ถ้าเพิ่งสร้าง)
      NEW.updated_by, 
      now()
    )
    ON CONFLICT (employee_id, accum_type, COALESCE(accum_year, -1))
    DO UPDATE SET
      amount = payroll_accumulation.amount + EXCLUDED.amount, -- บวก/ลบ ยอดเข้าไป
      updated_at = now(),
      updated_by = EXCLUDED.updated_by;
      
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- 2) Fix salary_raise_cycle_after_insert()
-- Insert to salary_raise_item requires company_id
-- =========================================
CREATE OR REPLACE FUNCTION salary_raise_cycle_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- สร้างรายการต่อพนักงาน Full-time with company_id from cycle
  INSERT INTO salary_raise_item (
    cycle_id, employee_id, company_id, tenure_days,
    current_salary, current_sso_wage,
    raise_percent, raise_amount, new_sso_wage,
    late_minutes, leave_days, leave_double_days, leave_hours, ot_hours,
    created_by, updated_by
  )
  SELECT
    NEW.id, e.id, NEW.company_id,
    (DATE(NEW.created_at) - e.employment_start_date) AS tenure_days,
    e.base_pay_amount, e.sso_declared_wage,
    0.00, 0.00,            -- เริ่มต้นยังไม่ปรับ
    e.sso_declared_wage,   -- default new_sso_wage
    -- ===== Snapshot เบื้องต้นจาก worklog_ft =====
    COALESCE((
      SELECT SUM(w.quantity)::INT
      FROM worklog_ft w
      WHERE w.employee_id = e.id
        AND w.entry_type = 'late'
        AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date
        AND w.deleted_at IS NULL
        AND w.status IN ('pending','approved')
    ),0) AS late_minutes,
    COALESCE((
      SELECT SUM(w.quantity)::NUMERIC(6,2)
      FROM worklog_ft w
      WHERE w.employee_id = e.id
        AND w.entry_type = 'leave_day'
        AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date
        AND w.deleted_at IS NULL
        AND w.status IN ('pending','approved')
    ),0.00) AS leave_days,
    COALESCE((
      SELECT SUM(w.quantity)::NUMERIC(6,2)
      FROM worklog_ft w
      WHERE w.employee_id = e.id
        AND w.entry_type = 'leave_double'
        AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date
        AND w.deleted_at IS NULL
        AND w.status IN ('pending','approved')
    ),0.00) AS leave_double_days,
    COALESCE((
      SELECT SUM(w.quantity)::NUMERIC(6,2)
      FROM worklog_ft w
      WHERE w.employee_id = e.id
        AND w.entry_type = 'leave_hours'
        AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date
        AND w.deleted_at IS NULL
        AND w.status IN ('pending','approved')
    ),0.00) AS leave_hours,
    COALESCE((
      SELECT SUM(w.quantity)::NUMERIC(6,2)
      FROM worklog_ft w
      WHERE w.employee_id = e.id
        AND w.entry_type = 'ot'
        AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date
        AND w.deleted_at IS NULL
        AND w.status IN ('pending','approved')
    ),0.00) AS ot_hours,
    NEW.created_by, NEW.updated_by
  FROM employees e
  JOIN employee_type et ON et.id = e.employee_type_id
  WHERE et.code = 'full_time'
    AND e.employment_end_date IS NULL
    AND e.deleted_at IS NULL
    AND e.company_id = NEW.company_id;  -- Only employees in same company

  RETURN NEW;
END$$;

-- =========================================
-- 3) Fix bonus_cycle_after_insert()
-- Insert to bonus_item requires company_id and branch_id
-- =========================================
CREATE OR REPLACE FUNCTION bonus_cycle_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO bonus_item (
    cycle_id, employee_id, company_id, branch_id, tenure_days,
    current_salary,
    late_minutes, leave_days, leave_double_days, leave_hours, ot_hours,
    bonus_months, bonus_amount,
    created_by, updated_by
  )
  SELECT
    NEW.id, e.id, NEW.company_id, NEW.branch_id,
    (DATE(NEW.created_at) - e.employment_start_date) AS tenure_days,
    e.base_pay_amount,
    -- snapshot เริ่มต้นจาก worklog_ft ตามช่วงรอบ
    COALESCE((
      SELECT SUM(w.quantity)::INT
      FROM worklog_ft w
      WHERE w.employee_id = e.id
        AND w.entry_type = 'late'
        AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date
        AND w.deleted_at IS NULL
        AND w.status IN ('pending','approved')
    ), 0) AS late_minutes,
    COALESCE((
      SELECT SUM(w.quantity)::NUMERIC(6,2)
      FROM worklog_ft w
      WHERE w.employee_id = e.id
        AND w.entry_type = 'leave_day'
        AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date
        AND w.deleted_at IS NULL
        AND w.status IN ('pending','approved')
    ), 0.00) AS leave_days,
    COALESCE((
      SELECT SUM(w.quantity)::NUMERIC(6,2)
      FROM worklog_ft w
      WHERE w.employee_id = e.id
        AND w.entry_type = 'leave_double'
        AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date
        AND w.deleted_at IS NULL
        AND w.status IN ('pending','approved')
    ), 0.00) AS leave_double_days,
    COALESCE((
      SELECT SUM(w.quantity)::NUMERIC(6,2)
      FROM worklog_ft w
      WHERE w.employee_id = e.id
        AND w.entry_type = 'leave_hours'
        AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date
        AND w.deleted_at IS NULL
        AND w.status IN ('pending','approved')
    ), 0.00) AS leave_hours,
    COALESCE((
      SELECT SUM(w.quantity)::NUMERIC(6,2)
      FROM worklog_ft w
      WHERE w.employee_id = e.id
        AND w.entry_type = 'ot'
        AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date
        AND w.deleted_at IS NULL
        AND w.status IN ('pending','approved')
    ), 0.00) AS ot_hours,
    0.00, 0.00,  -- เริ่มต้น bonus เดือน/จำนวน เป็น 0
    NEW.created_by, NEW.updated_by
  FROM employees e
  JOIN employee_type et ON et.id = e.employee_type_id
  WHERE et.code = 'full_time'
    AND e.employment_end_date IS NULL
    AND e.deleted_at IS NULL
    AND e.company_id = NEW.company_id
    AND e.branch_id = NEW.branch_id;  -- Only employees in same company and branch

  RETURN NEW;
END$$;

-- =========================================
-- 4) Fix payroll_run_generate_items()
-- Insert to payroll_run_item requires company_id and branch_id
-- =========================================
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

  -- คำนวณวันสิ้นงวด
  v_end_date := (NEW.payroll_month_date + interval '1 month' - interval '1 day')::date;
  v_sso_cap := LEAST(COALESCE(v_config.social_security_wage_cap, 15000.00), 15000.00);

  -- 2. วนลูปพนักงานทุกคนที่ Active ใน company/branch เดียวกัน
  FOR v_emp IN 
    SELECT e.*, t.code as type_code, t.name_th AS employee_type_name,
           d.name_th AS department_name, ep.name_th AS position_name
    FROM employees e
    JOIN employee_type t ON t.id = e.employee_type_id
    LEFT JOIN department d ON d.id = e.department_id
    LEFT JOIN employee_position ep ON ep.id = e.position_id
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
      
      IF v_late_mins > 15 THEN
        v_late_deduct := v_late_mins * 5;
      ELSE
        v_late_deduct := 0;
      END IF;

      -- 2) ลา (Leave Day)
      SELECT COALESCE(SUM(quantity), 0) INTO v_leave_days
      FROM worklog_ft 
      WHERE employee_id = v_emp.id AND entry_type = 'leave_day'
        AND work_date BETWEEN NEW.period_start_date AND v_end_date
        AND status IN ('pending', 'approved') AND deleted_at IS NULL;
      
      v_leave_deduct := ROUND((v_emp.base_pay_amount / 30.0) * v_leave_days, 2);

      -- 3) ลาหัก 2 เท่า (Leave Double)
      SELECT COALESCE(SUM(quantity), 0) INTO v_leave_double_days
      FROM worklog_ft 
      WHERE employee_id = v_emp.id AND entry_type = 'leave_double'
        AND work_date BETWEEN NEW.period_start_date AND v_end_date
        AND status IN ('pending', 'approved') AND deleted_at IS NULL;
      
      v_leave_double_deduct := ROUND(((v_emp.base_pay_amount / 30.0) * 2) * v_leave_double_days, 2);

      -- 4) ลารายชั่วโมง (Leave Hours)
      SELECT COALESCE(SUM(quantity), 0) INTO v_leave_hours
      FROM worklog_ft 
      WHERE employee_id = v_emp.id AND entry_type = 'leave_hours'
        AND work_date BETWEEN NEW.period_start_date AND v_end_date
        AND status IN ('pending', 'approved') AND deleted_at IS NULL;
      
      v_leave_hours_deduct := ROUND(((v_emp.base_pay_amount / 30.0) / 8.0) * v_leave_hours, 2);

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
          WHEN v_emp.type_code = 'full_time' AND v_ft_salary > 0 AND v_late_deduct = 0 AND v_emp.allow_attendance_bonus_nolate
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
        WHEN v_emp.type_code = 'full_time' AND v_ft_salary > 0 AND v_late_deduct = 0 AND v_emp.allow_attendance_bonus_nolate
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
      
      NEW.created_by, NEW.created_by
    );
    
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- 5) Fix payroll_run_on_approve_actions()
-- Insert to payroll_accumulation requires company_id
-- =========================================
CREATE OR REPLACE FUNCTION public.payroll_run_on_approve_actions() RETURNS trigger AS $$
DECLARE
  v_end_date DATE;
  v_year INT;
BEGIN
  -- ทำงานเฉพาะเมื่อมีการเปลี่ยนสถานะเป็น 'approved'
  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    
    v_end_date := (NEW.payroll_month_date + interval '1 month' - interval '1 day')::date;
    v_year := EXTRACT(YEAR FROM NEW.payroll_month_date)::INT;

    -- =================================================================
    -- 1. อัปเดตสถานะ Worklog (FT & PT) -> Approved
    -- =================================================================
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
    UPDATE debt_txn dt
    SET status = 'approved',
        updated_at = now(),
        updated_by = NEW.updated_by
    FROM payroll_run_item pri,
         jsonb_array_elements(pri.loan_repayments) AS elem
    WHERE pri.run_id = NEW.id
      AND elem->>'txn_id' IS NOT NULL
      AND dt.id = (elem->>'txn_id')::uuid
      AND dt.status = 'pending'
      AND dt.deleted_at IS NULL;

    UPDATE debt_txn dt
    SET status = 'approved',
        updated_at = now(),
        updated_by = NEW.updated_by
    FROM payroll_run_item pri
    WHERE pri.run_id = NEW.id
      AND dt.employee_id = pri.employee_id
      AND dt.payroll_month_date = NEW.payroll_month_date
      AND dt.txn_type = 'repayment'
      AND dt.status = 'pending'
      AND dt.deleted_at IS NULL;

    -- =================================================================
    -- 4. อัปเดต Payroll Accumulation (SSO, Tax, Income, PF) with company_id
    -- =================================================================
    
    -- 4.1 SSO (รายปี)
    INSERT INTO payroll_accumulation (
      employee_id, company_id, accum_type, accum_year, amount, updated_at, updated_by
    )
    SELECT 
      pri.employee_id, pri.company_id, 'sso', v_year, pri.sso_month_amount, now(), NEW.updated_by
    FROM payroll_run_item pri
    WHERE pri.run_id = NEW.id AND pri.sso_month_amount > 0
    ON CONFLICT (employee_id, accum_type, COALESCE(accum_year, -1))
    DO UPDATE SET 
      amount = payroll_accumulation.amount + EXCLUDED.amount,
      updated_at = EXCLUDED.updated_at,
      updated_by = EXCLUDED.updated_by;

    -- 4.2 TAX (รายปี)
    INSERT INTO payroll_accumulation (
      employee_id, company_id, accum_type, accum_year, amount, updated_at, updated_by
    )
    SELECT 
      pri.employee_id, pri.company_id, 'tax', v_year, pri.tax_month_amount, now(), NEW.updated_by
    FROM payroll_run_item pri
    WHERE pri.run_id = NEW.id AND pri.tax_month_amount > 0
    ON CONFLICT (employee_id, accum_type, COALESCE(accum_year, -1))
    DO UPDATE SET 
      amount = payroll_accumulation.amount + EXCLUDED.amount,
      updated_at = EXCLUDED.updated_at,
      updated_by = EXCLUDED.updated_by;

    -- 4.3 Income (รายปี)
    INSERT INTO payroll_accumulation (
      employee_id, company_id, accum_type, accum_year, amount, updated_at, updated_by
    )
    SELECT 
      pri.employee_id, pri.company_id, 'income', v_year, pri.income_total, now(), NEW.updated_by
    FROM payroll_run_item pri
    WHERE pri.run_id = NEW.id AND pri.income_total > 0
    ON CONFLICT (employee_id, accum_type, COALESCE(accum_year, -1))
    DO UPDATE SET 
      amount = payroll_accumulation.amount + EXCLUDED.amount,
      updated_at = EXCLUDED.updated_at,
      updated_by = EXCLUDED.updated_by;

    -- 4.4 Provident Fund (ตลอดชีพ / accum_year = NULL)
    INSERT INTO payroll_accumulation (
      employee_id, company_id, accum_type, accum_year, amount, updated_at, updated_by
    )
    SELECT 
      pri.employee_id, pri.company_id, 'pf', NULL, pri.pf_month_amount, now(), NEW.updated_by
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

-- =========================================
-- 6) Fix add_employee_to_pending_payroll_runs()
-- Insert to payroll_run_item requires company_id and branch_id
-- =========================================
CREATE OR REPLACE FUNCTION public.add_employee_to_pending_payroll_runs()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  r_run RECORD;
BEGIN
  FOR r_run IN
    SELECT id, period_start_date, company_id, branch_id
    FROM payroll_run
    WHERE status = 'pending'
      AND deleted_at IS NULL
      AND company_id = NEW.company_id
      AND branch_id = NEW.branch_id
  LOOP
    -- Only attach to runs that overlap the employment period (or no end date).
    IF NEW.employment_end_date IS NULL OR NEW.employment_end_date >= r_run.period_start_date THEN
      INSERT INTO payroll_run_item (
        run_id, employee_id, company_id, branch_id, employee_type_id,
        created_by, updated_by
      ) VALUES (
        r_run.id, NEW.id, r_run.company_id, r_run.branch_id, NEW.employee_type_id,
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

-- =========================================
-- PART 2: Scope sync/recalculate triggers to tenant
-- Align payroll run item recalculation and sync triggers with company/branch scoping
-- =========================================

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
  IF NOT FOUND OR v_run.status <> 'pending' THEN
    RETURN;
  END IF;

  SELECT e.*, t.code as type_code, t.name_th AS employee_type_name,
         d.name_th AS department_name, ep.name_th AS position_name
  INTO v_emp
  FROM employees e
  JOIN employee_type t ON t.id = e.employee_type_id
  LEFT JOIN department d ON d.id = e.department_id
  LEFT JOIN employee_position ep ON ep.id = e.position_id
  WHERE e.id = p_employee_id;

  IF v_emp IS NULL THEN RETURN; END IF;
  IF v_emp.company_id IS DISTINCT FROM v_run.company_id THEN RETURN; END IF;
  IF v_emp.branch_id IS DISTINCT FROM v_run.branch_id THEN RETURN; END IF;

  SELECT *
  INTO v_config
  FROM payroll_config pc
  WHERE pc.company_id = v_run.company_id
    AND pc.effective_daterange @> v_run.payroll_month_date
  ORDER BY lower(pc.effective_daterange) DESC, pc.version_no DESC
  LIMIT 1;

  IF v_config IS NULL THEN
    RETURN;
  END IF;

  v_end_date := (v_run.payroll_month_date + interval '1 month' - interval '1 day')::date;
  v_sso_cap := LEAST(COALESCE(v_config.social_security_wage_cap, 15000.00), 15000.00);

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
      WHEN v_emp.type_code='full_time' AND v_ft_salary > 0 AND v_late_deduct = 0 AND v_emp.allow_attendance_bonus_nolate
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
    water_rate_per_unit = v_config.water_rate_per_unit,
    electricity_rate_per_unit = v_config.electricity_rate_per_unit,
    internet_amount = CASE WHEN v_emp.allow_internet THEN v_config.internet_fee_monthly ELSE 0 END,
    water_meter_prev = COALESCE(v_water_prev, water_meter_prev),
    electric_meter_prev = COALESCE(v_electric_prev, electric_meter_prev),
      
    updated_at = now()
  WHERE run_id = p_run_id AND employee_id = p_employee_id
    AND company_id = v_run.company_id
    AND branch_id = v_run.branch_id;

END;
$$ LANGUAGE plpgsql;

-- Employees change: constrain to same tenant
CREATE OR REPLACE FUNCTION public.sync_payroll_on_employee_change() RETURNS trigger AS $$
DECLARE
  r_run RECORD;
  v_company UUID;
  v_branch UUID;
BEGIN
  v_company := COALESCE(NEW.company_id, OLD.company_id);
  v_branch := COALESCE(NEW.branch_id, OLD.branch_id);

  FOR r_run IN 
    SELECT id FROM payroll_run WHERE status = 'pending' AND deleted_at IS NULL
      AND company_id = v_company
      AND branch_id = v_branch
  LOOP
    PERFORM recalculate_payroll_item(r_run.id, COALESCE(NEW.id, OLD.id));
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Worklog change: constrain to same tenant
CREATE OR REPLACE FUNCTION public.sync_payroll_on_worklog_change() RETURNS trigger AS $$
DECLARE
  r_run RECORD;
  v_emp_id UUID;
  v_date DATE;
  v_end_date DATE;
  v_company UUID;
  v_branch UUID;
BEGIN
  v_emp_id := COALESCE(NEW.employee_id, OLD.employee_id);
  v_date := COALESCE(NEW.work_date, OLD.work_date);
  v_company := COALESCE(NEW.company_id, OLD.company_id);
  v_branch := COALESCE(NEW.branch_id, OLD.branch_id);

  -- หา Payroll Run ที่ช่วงวันที่ครอบคลุม work_date และยัง Pending
  FOR r_run IN 
    SELECT id, payroll_month_date, period_start_date 
    FROM payroll_run 
    WHERE status = 'pending' AND deleted_at IS NULL
      AND company_id = v_company
      AND branch_id = v_branch
  LOOP
    v_end_date := (r_run.payroll_month_date + interval '1 month' - interval '1 day')::date;
    
    IF v_date >= r_run.period_start_date AND v_date <= v_end_date THEN
      PERFORM recalculate_payroll_item(r_run.id, v_emp_id);
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Financial change: constrain to same tenant
CREATE OR REPLACE FUNCTION public.sync_payroll_on_financial_change() RETURNS trigger AS $$
DECLARE
  r_run RECORD;
  v_emp_id UUID;
  v_target_month DATE;
  v_txn_type TEXT; -- ใช้เฉพาะ debt_txn
  v_company UUID;
  v_branch UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_emp_id := OLD.employee_id;
  ELSE
    v_emp_id := NEW.employee_id;
  END IF;

  v_company := COALESCE(NEW.company_id, OLD.company_id);
  v_branch := COALESCE(NEW.branch_id, OLD.branch_id);
  
  -- กำหนด Target Month ตามตาราง
  IF TG_TABLE_NAME = 'bonus_item' THEN
    -- ต้อง join ไปหา cycle เพื่อดูเดือน
    SELECT payroll_month_date, company_id, branch_id
      INTO v_target_month, v_company, v_branch
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
        AND company_id = v_company
        AND branch_id = v_branch
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

-- Accumulation change: constrain to same tenant
CREATE OR REPLACE FUNCTION public.sync_payroll_on_accum_change() RETURNS trigger AS $$
DECLARE
  r_run RECORD;
  v_emp_id UUID;
  v_type TEXT;
  v_year INT;
  v_company UUID;
BEGIN
  v_emp_id := COALESCE(NEW.employee_id, OLD.employee_id);
  v_type := COALESCE(NEW.accum_type, OLD.accum_type);
  v_year := COALESCE(NEW.accum_year, OLD.accum_year);
  v_company := COALESCE(NEW.company_id, OLD.company_id);

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
      AND company_id = v_company
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

-- Payout PT paid: constrain to same tenant
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
        AND pr.company_id = NEW.company_id
        AND pr.branch_id = NEW.branch_id
        AND w.company_id = NEW.company_id
        AND w.branch_id = NEW.branch_id
        AND pi.company_id = NEW.company_id
        AND pi.branch_id = NEW.branch_id
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

-- Config change: constrain recalcs to same company
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
      AND company_id = NEW.company_id
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

-- =========================================
-- Align payroll_org_profile and payroll_config versioning 
-- and triggers with per-company scoping
-- =========================================

-- =========================================
-- PART 1: payroll_org_profile
-- =========================================

-- Allow duplicate version numbers across companies while keeping per-company uniqueness
DROP INDEX IF EXISTS payroll_org_profile_version_uk;
CREATE UNIQUE INDEX IF NOT EXISTS payroll_org_profile_company_version_uk
  ON payroll_org_profile(company_id, version_no);

-- Close previous versions only within the same company
CREATE OR REPLACE FUNCTION payroll_org_profile_auto_close_prev()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  start_date DATE;
BEGIN
  start_date := lower(NEW.effective_daterange);

  UPDATE payroll_org_profile p
  SET effective_daterange = CASE
        WHEN lower(p.effective_daterange) < start_date
          THEN daterange(lower(p.effective_daterange), start_date, '[)')
        ELSE p.effective_daterange
      END,
      status     = CASE WHEN p.status = 'active' THEN 'retired' ELSE p.status END,
      updated_at = now(),
      updated_by = NEW.updated_by
  WHERE p.id <> NEW.id
    AND p.company_id = NEW.company_id
    AND upper_inf(p.effective_daterange);

  RETURN NEW;
END$$;

-- Apply profiles only to pending runs within the same company
CREATE OR REPLACE FUNCTION payroll_org_profile_apply_to_pending_runs()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE payroll_run pr
  SET org_profile_id = NEW.id,
      org_profile_snapshot = jsonb_build_object(
        'profile_id', NEW.id,
        'version_no', NEW.version_no,
        'effective_start', lower(NEW.effective_daterange),
        'effective_end', upper(NEW.effective_daterange),
        'company_name', NEW.company_name,
        'address_line1', NEW.address_line1,
        'address_line2', NEW.address_line2,
        'subdistrict', NEW.subdistrict,
        'district', NEW.district,
        'province', NEW.province,
        'postal_code', NEW.postal_code,
        'phone_main', NEW.phone_main,
        'phone_alt', NEW.phone_alt,
        'email', NEW.email,
        'tax_id', NEW.tax_id,
        'slip_footer_note', NEW.slip_footer_note,
        'logo_id', NEW.logo_id
      )
  WHERE pr.status = 'pending'
    AND pr.deleted_at IS NULL
    AND pr.company_id = NEW.company_id
    AND NEW.effective_daterange @> pr.payroll_month_date;

  RETURN NEW;
END$$;

-- =========================================
-- PART 2: payroll_config 
-- =========================================

-- Version uniqueness: per-company instead of global
DROP INDEX IF EXISTS payroll_config_version_uk;
CREATE UNIQUE INDEX IF NOT EXISTS payroll_config_company_version_uk
  ON payroll_config(company_id, version_no);

-- No overlap constraint: add company_id scope
ALTER TABLE payroll_config DROP CONSTRAINT IF EXISTS payroll_config_no_overlap;
ALTER TABLE payroll_config
  ADD CONSTRAINT payroll_config_no_overlap
  EXCLUDE USING gist (
    company_id WITH =,
    effective_daterange WITH &&
  )
  WHERE (status = 'active')
  DEFERRABLE INITIALLY DEFERRED;

-- Close previous versions only within the same company
CREATE OR REPLACE FUNCTION payroll_config_auto_close_prev()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  start_date DATE;
BEGIN
  start_date := lower(NEW.effective_daterange);

  UPDATE payroll_config pc
  SET effective_daterange = CASE
        WHEN lower(pc.effective_daterange) < start_date
          THEN daterange(lower(pc.effective_daterange), start_date, '[)')
        ELSE pc.effective_daterange
      END,
      status     = CASE WHEN pc.status = 'active' THEN 'retired' ELSE pc.status END,
      updated_at = now(),
      updated_by = NEW.updated_by
  WHERE pc.id <> NEW.id
    AND pc.company_id = NEW.company_id  -- Only within same company
    AND upper_inf(pc.effective_daterange);

  RETURN NEW;
END$$;

-- Get effective config: scoped to company_id parameter
CREATE OR REPLACE FUNCTION get_effective_payroll_config(
  p_period_month DATE,
  p_company_id UUID DEFAULT NULL
) RETURNS payroll_config LANGUAGE sql AS $$
  SELECT pc.*
  FROM payroll_config pc
  WHERE pc.effective_daterange @> p_period_month
    AND (p_company_id IS NULL OR pc.company_id = p_company_id)
  ORDER BY lower(pc.effective_daterange) DESC, pc.version_no DESC
  LIMIT 1;
$$;

-- =========================================
-- Scope Pending Cycle Constraints to Branch-level
-- 
-- 1. Unique indexes: pending per branch
-- 2. Trigger sync functions: filter by branch_id
-- 3. RLS policies: salary_raise add branch filter
-- 4. Item creation: salary_raise add branch filter
-- =========================================

-- =========================================
-- 1) UNIQUE INDEXES
-- =========================================

-- salary_raise_cycle: pending per branch
DROP INDEX IF EXISTS salary_raise_cycle_pending_one_uk;
CREATE UNIQUE INDEX salary_raise_cycle_pending_branch_uk
  ON salary_raise_cycle (branch_id)
  WHERE status = 'pending' AND deleted_at IS NULL;

-- bonus_cycle: pending per branch
DROP INDEX IF EXISTS bonus_cycle_pending_one_uk;
CREATE UNIQUE INDEX bonus_cycle_pending_branch_uk
  ON bonus_cycle (branch_id)
  WHERE status = 'pending' AND deleted_at IS NULL;

-- bonus_cycle: approved month unique per branch
DROP INDEX IF EXISTS bonus_cycle_month_approved_uk;
CREATE UNIQUE INDEX bonus_cycle_month_branch_approved_uk
  ON bonus_cycle (branch_id, payroll_month_date)
  WHERE status = 'approved' AND deleted_at IS NULL;

-- =========================================
-- 2) TRIGGER SYNC FUNCTIONS - Add branch filter
-- =========================================

-- 2.1) worklog_ft_sync_salary_raise_item - sync worklog to salary_raise_item
CREATE OR REPLACE FUNCTION worklog_ft_sync_salary_raise_item()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_cycle_id UUID;
  v_start DATE;
  v_end   DATE;
  v_emp   UUID;
  v_emp_branch_id UUID;
  v_new_date DATE;
  v_old_date DATE;
BEGIN
  -- Get employee's branch_id
  IF TG_OP = 'DELETE' THEN
    v_emp := OLD.employee_id;
    v_old_date := OLD.work_date;
    SELECT branch_id INTO v_emp_branch_id FROM employees WHERE id = v_emp;
  ELSIF TG_OP = 'INSERT' THEN
    v_emp := NEW.employee_id;
    v_new_date := NEW.work_date;
    SELECT branch_id INTO v_emp_branch_id FROM employees WHERE id = v_emp;
  ELSE
    v_emp := COALESCE(NEW.employee_id, OLD.employee_id);
    v_new_date := NEW.work_date;
    v_old_date := OLD.work_date;
    SELECT branch_id INTO v_emp_branch_id FROM employees WHERE id = v_emp;
  END IF;

  -- Find pending cycle for this BRANCH (not global)
  SELECT id, period_start_date, period_end_date
    INTO v_cycle_id, v_start, v_end
  FROM salary_raise_cycle
  WHERE status = 'pending' AND deleted_at IS NULL
    AND branch_id = v_emp_branch_id
  LIMIT 1;

  IF v_cycle_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_new_date BETWEEN v_start AND v_end THEN
      PERFORM salary_raise_item_recompute_snapshot(v_cycle_id, v_emp);
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
      IF v_old_date BETWEEN v_start AND v_end THEN
        PERFORM salary_raise_item_recompute_snapshot(v_cycle_id, OLD.employee_id);
      END IF;
      IF v_new_date BETWEEN v_start AND v_end THEN
        PERFORM salary_raise_item_recompute_snapshot(v_cycle_id, NEW.employee_id);
      END IF;
      RETURN COALESCE(NEW, OLD);
    END IF;
    IF (v_new_date BETWEEN v_start AND v_end)
      OR (v_old_date BETWEEN v_start AND v_end)
      OR (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at)
      OR (NEW.status     IS DISTINCT FROM OLD.status)
      OR (NEW.entry_type IS DISTINCT FROM OLD.entry_type)
      OR (NEW.quantity   IS DISTINCT FROM OLD.quantity)
    THEN
      PERFORM salary_raise_item_recompute_snapshot(v_cycle_id, v_emp);
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF v_old_date BETWEEN v_start AND v_end THEN
      PERFORM salary_raise_item_recompute_snapshot(v_cycle_id, v_emp);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END$$;

-- 2.2) salary_raise_sync_item_on_employee_pay - sync employee pay to salary_raise_item
CREATE OR REPLACE FUNCTION salary_raise_sync_item_on_employee_pay()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_cycle_id UUID;
  v_cycle_created DATE;
  v_tenure INT;
BEGIN
  -- Find pending cycle for this employee's BRANCH
  SELECT id, DATE(created_at)
    INTO v_cycle_id, v_cycle_created
  FROM salary_raise_cycle
  WHERE status = 'pending' AND deleted_at IS NULL
    AND branch_id = NEW.branch_id
  LIMIT 1;

  IF v_cycle_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_tenure := (v_cycle_created - NEW.employment_start_date);

  UPDATE salary_raise_item
    SET current_salary   = NEW.base_pay_amount,
        current_sso_wage = NEW.sso_declared_wage,
        raise_amount     = CASE
                             WHEN raise_percent IS NOT NULL AND raise_percent <> 0
                               THEN ROUND(NEW.base_pay_amount * raise_percent / 100, 2)
                             ELSE raise_amount
                           END,
        tenure_days      = v_tenure,
        updated_at       = now()
  WHERE cycle_id = v_cycle_id
    AND employee_id = NEW.id;

  RETURN NEW;
END$$;

-- 2.3) worklog_ft_sync_bonus_item - sync worklog to bonus_item
CREATE OR REPLACE FUNCTION worklog_ft_sync_bonus_item()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_cycle_id UUID;
  v_start DATE;
  v_end   DATE;
  v_emp   UUID;
  v_emp_branch_id UUID;
  v_new_date DATE;
  v_old_date DATE;
BEGIN
  -- Get employee's branch_id
  IF TG_OP = 'DELETE' THEN
    v_emp := OLD.employee_id;
    v_old_date := OLD.work_date;
    SELECT branch_id INTO v_emp_branch_id FROM employees WHERE id = v_emp;
  ELSIF TG_OP = 'INSERT' THEN
    v_emp := NEW.employee_id;
    v_new_date := NEW.work_date;
    SELECT branch_id INTO v_emp_branch_id FROM employees WHERE id = v_emp;
  ELSE
    v_emp := COALESCE(NEW.employee_id, OLD.employee_id);
    v_new_date := NEW.work_date;
    v_old_date := OLD.work_date;
    SELECT branch_id INTO v_emp_branch_id FROM employees WHERE id = v_emp;
  END IF;

  -- Find pending cycle for this BRANCH
  SELECT id, period_start_date, period_end_date
    INTO v_cycle_id, v_start, v_end
  FROM bonus_cycle
  WHERE status = 'pending' AND deleted_at IS NULL
    AND branch_id = v_emp_branch_id
  LIMIT 1;

  IF v_cycle_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_new_date BETWEEN v_start AND v_end THEN
      PERFORM bonus_item_recompute_snapshot(v_cycle_id, v_emp);
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
      IF v_old_date BETWEEN v_start AND v_end THEN
        PERFORM bonus_item_recompute_snapshot(v_cycle_id, OLD.employee_id);
      END IF;
      IF v_new_date BETWEEN v_start AND v_end THEN
        PERFORM bonus_item_recompute_snapshot(v_cycle_id, NEW.employee_id);
      END IF;
      RETURN COALESCE(NEW, OLD);
    END IF;
    IF (v_new_date BETWEEN v_start AND v_end)
      OR (v_old_date BETWEEN v_start AND v_end)
      OR (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at)
      OR (NEW.status     IS DISTINCT FROM OLD.status)
      OR (NEW.entry_type IS DISTINCT FROM OLD.entry_type)
      OR (NEW.quantity   IS DISTINCT FROM OLD.quantity)
    THEN
      PERFORM bonus_item_recompute_snapshot(v_cycle_id, v_emp);
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF v_old_date BETWEEN v_start AND v_end THEN
      PERFORM bonus_item_recompute_snapshot(v_cycle_id, v_emp);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END$$;

-- 2.4) bonus_sync_item_on_employee_pay - sync employee pay to bonus_item
CREATE OR REPLACE FUNCTION bonus_sync_item_on_employee_pay()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_cycle_id UUID;
  v_cycle_created DATE;
  v_tenure INT;
BEGIN
  -- Find pending cycle for this employee's BRANCH
  SELECT id, DATE(created_at)
    INTO v_cycle_id, v_cycle_created
  FROM bonus_cycle
  WHERE status = 'pending' AND deleted_at IS NULL
    AND branch_id = NEW.branch_id
  LIMIT 1;

  IF v_cycle_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_tenure := (v_cycle_created - NEW.employment_start_date);

  UPDATE bonus_item
    SET current_salary = NEW.base_pay_amount,
        bonus_amount   = CASE
                           WHEN bonus_months IS NOT NULL AND bonus_months <> 0
                             THEN ROUND(NEW.base_pay_amount * bonus_months, 2)
                           ELSE bonus_amount
                         END,
        tenure_days    = v_tenure,
        updated_at     = now()
  WHERE cycle_id = v_cycle_id
    AND employee_id = NEW.id;

  RETURN NEW;
END$$;

-- =========================================
-- 3) FIX salary_raise_cycle_after_insert - add branch filter
-- =========================================
CREATE OR REPLACE FUNCTION salary_raise_cycle_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Create items for Full-time employees in SAME COMPANY AND BRANCH
  INSERT INTO salary_raise_item (
    cycle_id, employee_id, company_id, branch_id, tenure_days,
    current_salary, current_sso_wage,
    raise_percent, raise_amount, new_sso_wage,
    late_minutes, leave_days, leave_double_days, leave_hours, ot_hours,
    created_by, updated_by
  )
  SELECT
    NEW.id, e.id, NEW.company_id, NEW.branch_id,
    (DATE(NEW.created_at) - e.employment_start_date) AS tenure_days,
    e.base_pay_amount, e.sso_declared_wage,
    0.00, 0.00,
    e.sso_declared_wage,
    COALESCE((
      SELECT SUM(w.quantity)::INT
      FROM worklog_ft w
      WHERE w.employee_id = e.id
        AND w.entry_type = 'late'
        AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date
        AND w.deleted_at IS NULL
        AND w.status IN ('pending','approved')
    ),0) AS late_minutes,
    COALESCE((
      SELECT SUM(w.quantity)::NUMERIC(6,2)
      FROM worklog_ft w
      WHERE w.employee_id = e.id
        AND w.entry_type = 'leave_day'
        AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date
        AND w.deleted_at IS NULL
        AND w.status IN ('pending','approved')
    ),0.00) AS leave_days,
    COALESCE((
      SELECT SUM(w.quantity)::NUMERIC(6,2)
      FROM worklog_ft w
      WHERE w.employee_id = e.id
        AND w.entry_type = 'leave_double'
        AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date
        AND w.deleted_at IS NULL
        AND w.status IN ('pending','approved')
    ),0.00) AS leave_double_days,
    COALESCE((
      SELECT SUM(w.quantity)::NUMERIC(6,2)
      FROM worklog_ft w
      WHERE w.employee_id = e.id
        AND w.entry_type = 'leave_hours'
        AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date
        AND w.deleted_at IS NULL
        AND w.status IN ('pending','approved')
    ),0.00) AS leave_hours,
    COALESCE((
      SELECT SUM(w.quantity)::NUMERIC(6,2)
      FROM worklog_ft w
      WHERE w.employee_id = e.id
        AND w.entry_type = 'ot'
        AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date
        AND w.deleted_at IS NULL
        AND w.status IN ('pending','approved')
    ),0.00) AS ot_hours,
    NEW.created_by, NEW.updated_by
  FROM employees e
  JOIN employee_type et ON et.id = e.employee_type_id
  WHERE et.code = 'full_time'
    AND e.employment_end_date IS NULL
    AND e.deleted_at IS NULL
    AND e.company_id = NEW.company_id
    AND e.branch_id = NEW.branch_id;  -- ADD BRANCH FILTER

  RETURN NEW;
END$$;
