-- 1. Add manual override flags
ALTER TABLE payroll_run_item ADD COLUMN IF NOT EXISTS is_manual_tax BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE payroll_run_item ADD COLUMN IF NOT EXISTS is_manual_pf BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE payroll_run_item ADD COLUMN IF NOT EXISTS is_manual_internet BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE payroll_run_item ADD COLUMN IF NOT EXISTS is_manual_water BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE payroll_run_item ADD COLUMN IF NOT EXISTS is_manual_electric BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Update recalculation function
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

  -- Variables for manual preservation
  v_curr_item RECORD;
  v_water_rate NUMERIC(12,2) := 0;
  v_electric_rate NUMERIC(12,2) := 0;
  v_internet_amt NUMERIC(14,2) := 0;
  v_manual_debt_items JSONB := '[]'::jsonb;

BEGIN
  -- 1. ดึงข้อมูล Payroll Run และ Config
  SELECT * INTO v_run FROM payroll_run WHERE id = p_run_id;
  IF NOT FOUND OR v_run.status <> 'pending' THEN
    RETURN;
  END IF;

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

  -- [FIX]: Preserve existing manual items before recalculation
  SELECT * INTO v_curr_item
  FROM payroll_run_item
  WHERE run_id = p_run_id AND employee_id = p_employee_id;

  v_others_income := COALESCE(v_curr_item.others_income, '[]'::jsonb);
  v_others_deduction := COALESCE(v_curr_item.others_deduction, '[]'::jsonb);
  
  -- Extract manually added debt items (items without txn_id)
  -- Extract manually added debt items (items without txn_id)
  SELECT jsonb_agg(elem.value) INTO v_manual_debt_items
  FROM jsonb_array_elements(COALESCE(v_curr_item.loan_repayments, '[]'::jsonb)) elem
  WHERE elem->>'txn_id' IS NULL OR elem->>'txn_id' = '';

  IF v_manual_debt_items IS NULL THEN v_manual_debt_items := '[]'::jsonb; END IF;


  -- Update config logic
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
  IF COALESCE(v_curr_item.is_manual_pf, FALSE) THEN
    -- If manual, keep existing amount
    v_pf_amount := v_curr_item.pf_month_amount;
  ELSE
    IF v_emp.provident_fund_contribute THEN
      v_pf_amount := ROUND(COALESCE(v_ft_salary, 0) * COALESCE(v_emp.provident_fund_rate_employee, 0), 2);
    END IF;
  END IF;

  -- 4. การเงินอื่นๆ (Common)
  -- Salary Advance
  SELECT COALESCE(SUM(amount), 0) INTO v_adv
  FROM salary_advance
  WHERE employee_id = v_emp.id AND payroll_month_date = v_run.payroll_month_date 
    AND status = 'pending' AND deleted_at IS NULL;

  -- Debt Installments (Auto-Calculated)
  SELECT jsonb_agg(jsonb_build_object('txn_id', id, 'value', amount, 'name', 'ผ่อนชำระงวด ' || TO_CHAR(payroll_month_date, 'MM/YYYY')))
  INTO v_loan_repay_json
  FROM debt_txn
  WHERE employee_id = v_emp.id AND txn_type = 'installment' 
    AND payroll_month_date = v_run.payroll_month_date AND status = 'pending' AND deleted_at IS NULL;
  
  IF v_loan_repay_json IS NULL THEN v_loan_repay_json := '[]'::jsonb; END IF;

  -- [FIX: Debt] Merge Manual Items + Auto Items
  -- v_loan_repay_json has auto items. v_manual_debt_items has manual items.
  SELECT jsonb_agg(elem."value") INTO v_loan_repay_json
  FROM (
      SELECT "value" FROM jsonb_array_elements(v_loan_repay_json)
      UNION ALL
      SELECT "value" FROM jsonb_array_elements(v_manual_debt_items)
  ) elem;
  
  IF v_loan_repay_json IS NULL THEN v_loan_repay_json := '[]'::jsonb; END IF;
  
  -- Note: We do NOT recalculate v_loan_total here because the trigger 'payroll_run_item_compute_totals'
  -- will re-sum the loan_repayments column automatically after update.
  

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

  -- Utilities Logic
  -- Water
  IF COALESCE(v_curr_item.is_manual_water, FALSE) THEN
     v_water_rate := v_curr_item.water_rate_per_unit;
  ELSE
     v_water_rate := v_config.water_rate_per_unit;
  END IF;
  
  -- Electricity
  IF COALESCE(v_curr_item.is_manual_electric, FALSE) THEN
     v_electric_rate := v_curr_item.electricity_rate_per_unit;
  ELSE
     v_electric_rate := v_config.electricity_rate_per_unit;
  END IF;
  
  -- Internet
  IF COALESCE(v_curr_item.is_manual_internet, FALSE) THEN
     v_internet_amt := v_curr_item.internet_amount;
  ELSE
     IF v_emp.allow_internet THEN
        v_internet_amt := v_config.internet_fee_monthly;
     ELSE
        v_internet_amt := 0;
     END IF;
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

  IF COALESCE(v_curr_item.is_manual_tax, FALSE) THEN
    v_tax_month := v_curr_item.tax_month_amount;
  ELSE 
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
  END IF;

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
    
    -- Utilities Updates
    water_rate_per_unit = v_water_rate,
    electricity_rate_per_unit = v_electric_rate,
    internet_amount = v_internet_amt,
    
    water_meter_prev = COALESCE(v_water_prev, water_meter_prev),
    electric_meter_prev = COALESCE(v_electric_prev, electric_meter_prev),
    
    employee_settings_snapshot = v_settings_snapshot,
      
    updated_at = now()
  WHERE run_id = p_run_id AND employee_id = p_employee_id
    AND company_id = v_run.company_id
    AND branch_id = v_run.branch_id;

END;
$$ LANGUAGE plpgsql;
