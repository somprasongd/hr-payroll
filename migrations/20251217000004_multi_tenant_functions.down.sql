-- ==============================================================================
-- 20251217000004_multi_tenant_functions.down.sql
-- Reverting multi-tenant functions to their original non-multi-tenant state.
-- ==============================================================================

-- 1. Restore sync_loan_balance_to_accumulation
CREATE OR REPLACE FUNCTION public.sync_loan_balance_to_accumulation() RETURNS trigger AS $$
DECLARE
  v_diff NUMERIC(14,2) := 0;
  v_approved_now BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_approved_now := (NEW.status = 'approved');
  ELSE
    v_approved_now := (NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved'));
  END IF;

  IF v_approved_now THEN
    IF NEW.txn_type IN ('loan', 'other') THEN
      v_diff := NEW.amount;
    ELSIF NEW.txn_type IN ('repayment', 'installment') THEN
      v_diff := -NEW.amount;
    END IF;

    INSERT INTO payroll_accumulation (
      employee_id, accum_type, accum_year, amount, updated_by, updated_at
    )
    VALUES (
      NEW.employee_id, 
      'loan_outstanding', 
      NULL,
      v_diff,
      NEW.updated_by, 
      now()
    )
    ON CONFLICT (employee_id, accum_type, COALESCE(accum_year, -1))
    DO UPDATE SET
      amount = payroll_accumulation.amount + EXCLUDED.amount,
      updated_at = now(),
      updated_by = EXCLUDED.updated_by;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Restore salary_raise_cycle_after_insert
CREATE OR REPLACE FUNCTION salary_raise_cycle_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO salary_raise_item (
    cycle_id, employee_id, tenure_days,
    current_salary, current_sso_wage,
    raise_percent, raise_amount, new_sso_wage,
    late_minutes, leave_days, leave_double_days, leave_hours, ot_hours,
    created_by, updated_by
  )
  SELECT
    NEW.id, e.id,
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
    NEW.created_by, NEW.updated_by
  FROM employees e
  JOIN employee_type et ON et.id = e.employee_type_id
  WHERE et.code = 'full_time'
    AND e.employment_end_date IS NULL
    AND e.deleted_at IS NULL;

  RETURN NEW;
END$$;

-- 3. Restore bonus_cycle_after_insert
CREATE OR REPLACE FUNCTION bonus_cycle_after_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO bonus_item (
    cycle_id, employee_id, tenure_days,
    current_salary,
    late_minutes, leave_days, leave_double_days, leave_hours, ot_hours,
    bonus_months, bonus_amount,
    created_by, updated_by
  )
  SELECT
    NEW.id, e.id,
    (DATE(NEW.created_at) - e.employment_start_date) AS tenure_days,
    e.base_pay_amount,
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
    0.00, 0.00,
    NEW.created_by, NEW.updated_by
  FROM employees e
  JOIN employee_type et ON et.id = e.employee_type_id
  WHERE et.code = 'full_time'
    AND e.employment_end_date IS NULL
    AND e.deleted_at IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Restore payroll_run_generate_items
CREATE OR REPLACE FUNCTION public.payroll_run_generate_items() RETURNS trigger AS $$
DECLARE
  v_config RECORD;
  v_emp RECORD;
  v_end_date DATE;
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
  v_pf_amount NUMERIC(14,2) := 0;
  v_water_prev NUMERIC(12,2);
  v_electric_prev NUMERIC(12,2);
  v_income_total NUMERIC(14,2) := 0;
  v_tax_month NUMERIC(14,2) := 0;
  v_pt_hours NUMERIC(10,2);
BEGIN
  SELECT * INTO v_config 
  FROM get_effective_payroll_config(NEW.payroll_month_date);

  IF v_config IS NULL THEN
    RAISE EXCEPTION 'ไม่พบ Payroll Config สำหรับงวดวันที่ %', NEW.payroll_month_date;
  END IF;

  v_end_date := (NEW.payroll_month_date + interval '1 month' - interval '1 day')::date;
  v_sso_cap := LEAST(COALESCE(v_config.social_security_wage_cap, 17500.00), 17500.00);

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

    IF v_emp.type_code = 'full_time' THEN
      v_ft_salary := v_emp.base_pay_amount;

      SELECT COALESCE(SUM(quantity), 0) INTO v_ot_hours
      FROM worklog_ft 
      WHERE employee_id = v_emp.id AND entry_type = 'ot' 
        AND work_date BETWEEN NEW.period_start_date AND v_end_date
        AND status = 'pending' AND deleted_at IS NULL;
      
      v_ot_amount := v_ot_hours * v_config.ot_hourly_rate;

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

      SELECT COALESCE(SUM(quantity), 0) INTO v_leave_days
      FROM worklog_ft 
      WHERE employee_id = v_emp.id AND entry_type = 'leave_day'
        AND work_date BETWEEN NEW.period_start_date AND v_end_date
        AND status = 'pending' AND deleted_at IS NULL;
      
      v_leave_deduct := ROUND((v_emp.base_pay_amount / 30.0) * v_leave_days, 2);

      SELECT COALESCE(SUM(quantity), 0) INTO v_leave_double_days
      FROM worklog_ft 
      WHERE employee_id = v_emp.id AND entry_type = 'leave_double'
        AND work_date BETWEEN NEW.period_start_date AND v_end_date
        AND status = 'pending' AND deleted_at IS NULL;
      
      v_leave_double_deduct := ROUND(((v_emp.base_pay_amount / 30.0) * 2) * v_leave_double_days, 2);

      SELECT COALESCE(SUM(quantity), 0) INTO v_leave_hours
      FROM worklog_ft 
      WHERE employee_id = v_emp.id AND entry_type = 'leave_hours'
        AND work_date BETWEEN NEW.period_start_date AND v_end_date
        AND status = 'pending' AND deleted_at IS NULL;
      
      v_leave_hours_deduct := ROUND(((v_emp.base_pay_amount / 30.0) / COALESCE(v_config.work_hours_per_day, 8.0)) * v_leave_hours, 2);

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

    v_pf_amount := 0;
    IF v_emp.provident_fund_contribute THEN
        v_pf_amount := ROUND(COALESCE(v_ft_salary, 0) * COALESCE(v_emp.provident_fund_rate_employee, 0), 2);
    END IF;

    IF v_emp.allow_doctor_fee THEN
      v_doctor_fee := 0;
    END IF;

    v_income_total :=
        COALESCE(v_ft_salary,0) +
        COALESCE(v_ot_amount,0) +
        CASE WHEN v_emp.type_code = 'full_time' AND v_emp.allow_housing THEN v_config.housing_allowance ELSE 0 END +
        CASE
          WHEN v_emp.type_code = 'full_time' AND v_ft_salary > 0 AND v_late_mins = 0
               AND v_emp.allow_attendance_bonus_nolate
            THEN v_config.attendance_bonus_no_late
          ELSE 0
        END +
        CASE
          WHEN v_emp.type_code = 'full_time' AND v_ft_salary > 0
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
      CASE WHEN v_emp.type_code = 'full_time' AND v_emp.allow_housing THEN v_config.housing_allowance ELSE 0 END,
      CASE
        WHEN v_emp.type_code = 'full_time' AND v_ft_salary > 0 AND v_late_mins = 0
             AND v_emp.allow_attendance_bonus_nolate
          THEN v_config.attendance_bonus_no_late
        ELSE 0
      END,
      CASE
        WHEN v_emp.type_code = 'full_time' AND v_ft_salary > 0
             AND v_leave_deduct = 0 AND v_leave_double_deduct = 0 AND v_leave_hours_deduct = 0
             AND v_emp.allow_attendance_bonus_noleave
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

-- 5. Restore payroll_run_on_approve_actions
CREATE OR REPLACE FUNCTION public.payroll_run_on_approve_actions() RETURNS trigger AS $$
DECLARE
  v_end_date DATE;
  v_year INT;
BEGIN
  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    v_end_date := (NEW.payroll_month_date + interval '1 month' - interval '1 day')::date;
    v_year := EXTRACT(YEAR FROM NEW.payroll_month_date)::INT;

    UPDATE worklog_ft w
    SET status = 'approved', updated_at = now(), updated_by = NEW.updated_by
    FROM payroll_run_item pri
    WHERE pri.run_id = NEW.id AND w.employee_id = pri.employee_id
      AND w.work_date >= NEW.period_start_date AND w.work_date <= v_end_date
      AND w.status = 'pending' AND w.deleted_at IS NULL;

    UPDATE worklog_pt w
    SET status = 'approved', updated_at = now(), updated_by = NEW.updated_by
    FROM payroll_run_item pri
    WHERE pri.run_id = NEW.id AND w.employee_id = pri.employee_id
      AND w.work_date >= NEW.period_start_date AND w.work_date <= v_end_date
      AND w.status = 'pending' AND w.deleted_at IS NULL;

    UPDATE salary_advance sa
    SET status = 'processed', updated_at = now(), updated_by = NEW.updated_by
    FROM payroll_run_item pri
    WHERE pri.run_id = NEW.id AND sa.employee_id = pri.employee_id
      AND sa.payroll_month_date = NEW.payroll_month_date
      AND sa.status = 'pending' AND sa.deleted_at IS NULL;

    UPDATE debt_txn dt
    SET status = 'approved', updated_at = now(), updated_by = NEW.updated_by
    FROM payroll_run_item pri, jsonb_array_elements(pri.loan_repayments) AS elem
    WHERE pri.run_id = NEW.id AND elem->>'txn_id' IS NOT NULL
      AND dt.id = (elem->>'txn_id')::uuid AND dt.status = 'pending' AND dt.deleted_at IS NULL;

    UPDATE debt_txn dt
    SET status = 'approved', updated_at = now(), updated_by = NEW.updated_by
    FROM payroll_run_item pri
    WHERE pri.run_id = NEW.id AND dt.employee_id = pri.employee_id
      AND dt.payroll_month_date = NEW.payroll_month_date
      AND dt.txn_type = 'repayment' AND dt.status = 'pending' AND dt.deleted_at IS NULL;

    INSERT INTO payroll_accumulation (employee_id, accum_type, accum_year, amount, updated_at, updated_by)
    SELECT pri.employee_id, 'sso', v_year, pri.sso_month_amount, now(), NEW.updated_by
    FROM payroll_run_item pri
    WHERE pri.run_id = NEW.id AND pri.sso_month_amount > 0
    ON CONFLICT (employee_id, accum_type, COALESCE(accum_year, -1))
    DO UPDATE SET amount = payroll_accumulation.amount + EXCLUDED.amount, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by;

    INSERT INTO payroll_accumulation (employee_id, accum_type, accum_year, amount, updated_at, updated_by)
    SELECT pri.employee_id, 'tax', v_year, pri.tax_month_amount, now(), NEW.updated_by
    FROM payroll_run_item pri
    WHERE pri.run_id = NEW.id AND pri.tax_month_amount > 0
    ON CONFLICT (employee_id, accum_type, COALESCE(accum_year, -1))
    DO UPDATE SET amount = payroll_accumulation.amount + EXCLUDED.amount, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by;

    INSERT INTO payroll_accumulation (employee_id, accum_type, accum_year, amount, updated_at, updated_by)
    SELECT pri.employee_id, 'income', v_year, pri.income_total, now(), NEW.updated_by
    FROM payroll_run_item pri
    WHERE pri.run_id = NEW.id AND pri.income_total > 0
    ON CONFLICT (employee_id, accum_type, COALESCE(accum_year, -1))
    DO UPDATE SET amount = payroll_accumulation.amount + EXCLUDED.amount, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by;

    INSERT INTO payroll_accumulation (employee_id, accum_type, accum_year, amount, updated_at, updated_by)
    SELECT pri.employee_id, 'pf', NULL, pri.pf_month_amount, now(), NEW.updated_by
    FROM payroll_run_item pri
    WHERE pri.run_id = NEW.id AND pri.pf_month_amount > 0
    ON CONFLICT (employee_id, accum_type, COALESCE(accum_year, -1))
    DO UPDATE SET amount = payroll_accumulation.amount + EXCLUDED.amount, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Restore recalculate_payroll_item
CREATE OR REPLACE FUNCTION public.recalculate_payroll_item(p_run_id UUID, p_employee_id UUID) RETURNS void AS $$
DECLARE
  v_run RECORD;
  v_config RECORD;
  v_emp RECORD;
  v_end_date DATE;
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
BEGIN
  SELECT * INTO v_run FROM payroll_run WHERE id = p_run_id;
  IF v_run.status <> 'pending' THEN RETURN; END IF;
  SELECT * INTO v_config FROM get_effective_payroll_config(v_run.payroll_month_date);
  v_end_date := (v_run.payroll_month_date + interval '1 month' - interval '1 day')::date;
  v_sso_cap := LEAST(COALESCE(v_config.social_security_wage_cap, 17500.00), 17500.00);

  SELECT e.*, t.code as type_code, t.name_th AS employee_type_name, d.name_th AS department_name, ep.name_th AS position_name
  INTO v_emp
  FROM employees e JOIN employee_type t ON t.id = e.employee_type_id LEFT JOIN department d ON d.id = e.department_id LEFT JOIN employee_position ep ON ep.id = e.position_id
  WHERE e.id = p_employee_id;

  IF v_emp IS NULL THEN DELETE FROM payroll_run_item WHERE run_id = p_run_id AND employee_id = p_employee_id; RETURN; END IF;
  IF v_emp.deleted_at IS NOT NULL OR (v_emp.employment_end_date IS NOT NULL AND v_emp.employment_end_date < v_run.period_start_date) THEN
    DELETE FROM payroll_run_item WHERE run_id = p_run_id AND employee_id = p_employee_id; RETURN;
  END IF;

  IF v_emp.type_code = 'full_time' THEN
    v_ft_salary := v_emp.base_pay_amount;
    SELECT COALESCE(SUM(quantity), 0) INTO v_ot_hours FROM worklog_ft WHERE employee_id = v_emp.id AND entry_type = 'ot' AND work_date BETWEEN v_run.period_start_date AND v_end_date AND status = 'pending' AND deleted_at IS NULL;
    v_ot_amount := v_ot_hours * v_config.ot_hourly_rate;
    SELECT COALESCE(SUM(quantity), 0) INTO v_late_mins FROM worklog_ft WHERE employee_id = v_emp.id AND entry_type = 'late' AND work_date BETWEEN v_run.period_start_date AND v_end_date AND status = 'pending' AND deleted_at IS NULL;
    IF v_late_mins > COALESCE(v_config.late_grace_minutes, 15) THEN v_late_deduct := v_late_mins * COALESCE(v_config.late_rate_per_minute, 5); END IF;
    SELECT COALESCE(SUM(quantity), 0) INTO v_leave_days FROM worklog_ft WHERE employee_id = v_emp.id AND entry_type = 'leave_day' AND work_date BETWEEN v_run.period_start_date AND v_end_date AND status = 'pending' AND deleted_at IS NULL;
    v_leave_deduct := ROUND((v_emp.base_pay_amount / 30.0) * v_leave_days, 2);
    SELECT COALESCE(SUM(quantity), 0) INTO v_leave_double_days FROM worklog_ft WHERE employee_id = v_emp.id AND entry_type = 'leave_double' AND work_date BETWEEN v_run.period_start_date AND v_end_date AND status = 'pending' AND deleted_at IS NULL;
    v_leave_double_deduct := ROUND(((v_emp.base_pay_amount / 30.0) * 2) * v_leave_double_days, 2);
    SELECT COALESCE(SUM(quantity), 0) INTO v_leave_hours FROM worklog_ft WHERE employee_id = v_emp.id AND entry_type = 'leave_hours' AND work_date BETWEEN v_run.period_start_date AND v_end_date AND status = 'pending' AND deleted_at IS NULL;
    v_leave_hours_deduct := ROUND(((v_emp.base_pay_amount / 30.0) / COALESCE(v_config.work_hours_per_day, 8.0)) * v_leave_hours, 2);
  ELSIF v_emp.type_code = 'part_time' THEN
    SELECT COALESCE(SUM(w.total_hours), 0) INTO v_pt_hours FROM worklog_pt w WHERE w.employee_id = v_emp.id AND w.work_date BETWEEN v_run.period_start_date AND v_end_date AND w.status = 'pending' AND w.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM payout_pt_item pi JOIN payout_pt p ON p.id = pi.payout_id WHERE pi.worklog_id = w.id AND pi.deleted_at IS NULL AND p.deleted_at IS NULL AND p.status = 'paid');
    v_ft_salary := ROUND(v_pt_hours * v_emp.base_pay_amount, 2);
  END IF;

  v_sso_base := 0; v_sso_amount := 0;
  IF v_emp.sso_contribute THEN
    IF v_emp.type_code = 'full_time' THEN v_sso_base := v_emp.sso_declared_wage;
    ELSE v_sso_base := LEAST(v_ft_salary, v_sso_cap); END IF;
    v_sso_base := LEAST(COALESCE(v_sso_base, 0), v_sso_cap);
    v_sso_amount := ROUND(v_sso_base * v_run.social_security_rate_employee, 2);
  END IF;

  v_pf_amount := 0;
  IF v_emp.provident_fund_contribute THEN v_pf_amount := ROUND(COALESCE(v_ft_salary, 0) * COALESCE(v_emp.provident_fund_rate_employee, 0), 2); END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_adv FROM salary_advance WHERE employee_id = v_emp.id AND payroll_month_date = v_run.payroll_month_date AND status = 'pending' AND deleted_at IS NULL;
  SELECT jsonb_agg(jsonb_build_object('txn_id', id, 'value', amount, 'name', 'ผ่อนชำระงวด ' || TO_CHAR(payroll_month_date, 'MM/YYYY'))), COALESCE(SUM(amount), 0) INTO v_loan_repay_json, v_loan_total FROM debt_txn WHERE employee_id = v_emp.id AND txn_type = 'installment' AND payroll_month_date = v_run.payroll_month_date AND status = 'pending' AND deleted_at IS NULL;
  IF v_loan_repay_json IS NULL THEN v_loan_repay_json := '[]'::jsonb; END IF;
  SELECT COALESCE(SUM(bi.bonus_amount), 0) INTO v_bonus_amt FROM bonus_item bi JOIN bonus_cycle bc ON bc.id = bi.cycle_id WHERE bi.employee_id = v_emp.id AND bc.payroll_month_date = v_run.payroll_month_date AND bc.status = 'approved' AND bc.deleted_at IS NULL;

  SELECT COALESCE(amount, 0) INTO v_sso_prev FROM payroll_accumulation WHERE employee_id = v_emp.id AND accum_type = 'sso' AND accum_year = EXTRACT(YEAR FROM v_run.payroll_month_date);
  SELECT COALESCE(amount, 0) INTO v_tax_prev FROM payroll_accumulation WHERE employee_id = v_emp.id AND accum_type = 'tax' AND accum_year = EXTRACT(YEAR FROM v_run.payroll_month_date);
  SELECT COALESCE(amount, 0) INTO v_income_prev FROM payroll_accumulation WHERE employee_id = v_emp.id AND accum_type = 'income' AND accum_year = EXTRACT(YEAR FROM v_run.payroll_month_date);
  SELECT COALESCE(amount, 0) INTO v_pf_prev FROM payroll_accumulation WHERE employee_id = v_emp.id AND accum_type = 'pf' AND accum_year IS NULL;
  SELECT COALESCE(amount, 0) INTO v_loan_prev FROM payroll_accumulation WHERE employee_id = v_emp.id AND accum_type = 'loan_outstanding';

  IF v_emp.allow_doctor_fee THEN
    SELECT COALESCE(doctor_fee, 0) INTO v_doctor_fee FROM payroll_run_item WHERE run_id = p_run_id AND employee_id = v_emp.id;
  ELSE v_doctor_fee := 0;
  END IF;

  v_water_prev := NULL; v_electric_prev := NULL;
  SELECT pri.water_meter_curr, pri.electric_meter_curr INTO v_water_prev, v_electric_prev FROM payroll_run_item pri JOIN payroll_run pr ON pr.id = pri.run_id WHERE pri.employee_id = v_emp.id AND pr.payroll_month_date < v_run.payroll_month_date AND pr.status = 'approved' AND pr.deleted_at IS NULL ORDER BY pr.payroll_month_date DESC LIMIT 1;

  v_income_total := COALESCE(v_ft_salary,0) + COALESCE(v_ot_amount,0) + CASE WHEN v_emp.type_code='full_time' AND v_emp.allow_housing THEN v_config.housing_allowance ELSE 0 END + CASE WHEN v_emp.type_code='full_time' AND v_ft_salary > 0 AND v_late_mins = 0 AND v_emp.allow_attendance_bonus_nolate THEN v_config.attendance_bonus_no_late ELSE 0 END + CASE WHEN v_emp.type_code='full_time' AND v_ft_salary > 0 AND v_leave_deduct = 0 AND v_leave_double_deduct = 0 AND v_leave_hours_deduct = 0 AND v_emp.allow_attendance_bonus_noleave THEN v_config.attendance_bonus_no_leave ELSE 0 END + COALESCE(v_bonus_amt,0) + COALESCE(v_doctor_fee,0) + COALESCE(jsonb_sum_value(v_others_income),0);

  v_tax_month := calculate_withholding_tax(v_income_total, v_emp.withhold_tax, v_emp.sso_contribute, v_run.social_security_rate_employee, v_sso_cap, v_sso_base, v_config.tax_apply_standard_expense, v_config.tax_standard_expense_rate, v_config.tax_standard_expense_cap, v_config.tax_apply_personal_allowance, v_config.tax_personal_allowance_amount, v_config.tax_progressive_brackets, v_config.withholding_tax_rate_service);

  UPDATE payroll_run_item SET employee_type_id = v_emp.employee_type_id, employee_type_name = v_emp.employee_type_name, department_name = v_emp.department_name, position_name = v_emp.position_name, bank_name = v_emp.bank_name, bank_account_no = v_emp.bank_account_no, salary_amount = v_ft_salary, pt_hours_worked = CASE WHEN v_emp.type_code='part_time' THEN v_pt_hours ELSE 0 END, pt_hourly_rate = CASE WHEN v_emp.type_code='part_time' THEN v_emp.base_pay_amount ELSE 0 END, ot_hours = v_ot_hours, ot_amount = v_ot_amount, bonus_amount = v_bonus_amt, housing_allowance = CASE WHEN v_emp.type_code='full_time' AND v_emp.allow_housing THEN v_config.housing_allowance ELSE 0 END, attendance_bonus_nolate = CASE WHEN v_emp.type_code='full_time' AND v_ft_salary > 0 AND v_late_mins = 0 AND v_emp.allow_attendance_bonus_nolate THEN v_config.attendance_bonus_no_late ELSE 0 END, attendance_bonus_noleave = CASE WHEN v_emp.type_code='full_time' AND v_ft_salary > 0 AND v_leave_deduct = 0 AND v_leave_double_deduct = 0 AND v_leave_hours_deduct = 0 AND v_emp.allow_attendance_bonus_noleave THEN v_config.attendance_bonus_no_leave ELSE 0 END, late_minutes_qty = v_late_mins, late_minutes_deduction = v_late_deduct, leave_days_qty = v_leave_days, leave_days_deduction = v_leave_deduct, leave_double_qty = v_leave_double_days, leave_double_deduction = v_leave_double_deduct, leave_hours_qty = v_leave_hours, leave_hours_deduction = v_leave_hours_deduct, advance_amount = v_adv, loan_repayments = v_loan_repay_json, doctor_fee = v_doctor_fee, others_income = v_others_income, others_deduction = v_others_deduction, sso_declared_wage = v_sso_base, sso_month_amount = v_sso_amount, sso_accum_prev = COALESCE(v_sso_prev,0), tax_accum_prev = COALESCE(v_tax_prev,0), tax_month_amount = v_tax_month, income_accum_prev = COALESCE(v_income_prev,0), pf_accum_prev = COALESCE(v_pf_prev,0), pf_month_amount = v_pf_amount, loan_outstanding_prev = COALESCE(v_loan_prev,0), water_rate_per_unit = v_config.water_rate_per_unit, electricity_rate_per_unit = v_config.electricity_rate_per_unit, internet_amount = CASE WHEN v_emp.allow_internet THEN v_config.internet_fee_monthly ELSE 0 END, water_meter_prev = COALESCE(v_water_prev, water_meter_prev), electric_meter_prev = COALESCE(v_electric_prev, electric_meter_prev), updated_at = now() WHERE run_id = p_run_id AND employee_id = p_employee_id;
END;
$$ LANGUAGE plpgsql;

-- 7. Restore sync_payroll_on_employee_change
CREATE OR REPLACE FUNCTION public.sync_payroll_on_employee_change() RETURNS trigger AS $$
DECLARE
  r_run RECORD;
  v_emp_id UUID;
  v_end_date DATE;
  v_deleted_at TIMESTAMPTZ;
BEGIN
  v_emp_id := COALESCE(NEW.id, OLD.id);
  v_end_date := COALESCE(NEW.employment_end_date, OLD.employment_end_date);
  v_deleted_at := COALESCE(NEW.deleted_at, OLD.deleted_at);

  FOR r_run IN 
    SELECT id, period_start_date FROM payroll_run WHERE status = 'pending' AND deleted_at IS NULL
  LOOP
    IF v_deleted_at IS NOT NULL
       OR (v_end_date IS NOT NULL AND v_end_date < r_run.period_start_date) THEN
      DELETE FROM payroll_run_item
      WHERE run_id = r_run.id AND employee_id = v_emp_id;
      CONTINUE;
    END IF;
    PERFORM recalculate_payroll_item(r_run.id, v_emp_id);
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Restore sync_payroll_on_worklog_change
CREATE OR REPLACE FUNCTION public.sync_payroll_on_worklog_change() RETURNS trigger AS $$
DECLARE
  r_run RECORD;
  v_emp_id UUID;
  v_date DATE;
  v_end_date DATE;
BEGIN
  v_emp_id := COALESCE(NEW.employee_id, OLD.employee_id);
  v_date := COALESCE(NEW.work_date, OLD.work_date);

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

-- 9. Restore sync_payroll_on_financial_change
CREATE OR REPLACE FUNCTION public.sync_payroll_on_financial_change() RETURNS trigger AS $$
DECLARE
  r_run RECORD;
  v_emp_id UUID;
  v_target_month DATE;
  v_txn_type TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN v_emp_id := OLD.employee_id; ELSE v_emp_id := NEW.employee_id; END IF;
  
  IF TG_TABLE_NAME = 'bonus_item' THEN
    SELECT payroll_month_date INTO v_target_month FROM bonus_cycle WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.cycle_id ELSE NEW.cycle_id END;
  ELSIF TG_TABLE_NAME = 'debt_txn' THEN
    v_txn_type := CASE WHEN TG_OP = 'DELETE' THEN OLD.txn_type ELSE NEW.txn_type END;
    v_target_month := CASE WHEN TG_OP = 'DELETE' THEN OLD.payroll_month_date ELSE NEW.payroll_month_date END;
  ELSE
    v_target_month := CASE WHEN TG_OP = 'DELETE' THEN OLD.payroll_month_date ELSE NEW.payroll_month_date END;
  END IF;

  IF TG_TABLE_NAME = 'debt_txn' AND v_txn_type <> 'installment' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF v_target_month IS NOT NULL THEN
    FOR r_run IN SELECT id FROM payroll_run WHERE payroll_month_date = v_target_month AND status = 'pending' AND deleted_at IS NULL
    LOOP
      PERFORM recalculate_payroll_item(r_run.id, v_emp_id);
    END LOOP;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_sync_payroll_bonus_cycle ON bonus_cycle;
DROP FUNCTION IF EXISTS public.sync_payroll_on_bonus_cycle_change();

-- 10. Restore sync_payroll_on_accum_change
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
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  FOR r_run IN
    SELECT id, payroll_month_date FROM payroll_run WHERE status = 'pending' AND deleted_at IS NULL
      AND (
        (v_type IN ('sso', 'sso_employer', 'tax', 'income') AND v_year IS NOT NULL AND EXTRACT(YEAR FROM payroll_month_date) = v_year)
        OR (v_type IN ('pf', 'pf_employer', 'loan_outstanding') AND v_year IS NULL)
      )
  LOOP
    PERFORM recalculate_payroll_item(r_run.id, v_emp_id);
  END LOOP;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Restore sync_payroll_on_payout_pt_paid
CREATE OR REPLACE FUNCTION public.sync_payroll_on_payout_pt_paid() RETURNS trigger AS $$
DECLARE
  r_target RECORD;
BEGIN
  IF NEW.status = 'paid' AND OLD.status <> 'paid' THEN
    FOR r_target IN
      SELECT DISTINCT pr.id AS run_id, w.employee_id
      FROM payout_pt_item pi
      JOIN worklog_pt w ON w.id = pi.worklog_id
      JOIN payroll_run pr ON pr.status = 'pending' AND pr.deleted_at IS NULL
        AND w.work_date BETWEEN pr.period_start_date AND (pr.payroll_month_date + interval '1 month' - interval '1 day')::date
      WHERE pi.payout_id = NEW.id AND pi.deleted_at IS NULL AND w.deleted_at IS NULL
    LOOP
      PERFORM recalculate_payroll_item(r_target.run_id, r_target.employee_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 12. Restore sync_payroll_on_config_change
CREATE OR REPLACE FUNCTION public.sync_payroll_on_config_change() RETURNS trigger AS $$
DECLARE
  r_run RECORD;
  r_item RECORD;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;

  FOR r_run IN SELECT id, payroll_month_date FROM payroll_run WHERE status = 'pending' AND deleted_at IS NULL
  LOOP
    IF NEW.effective_daterange @> r_run.payroll_month_date THEN
      FOR r_item IN SELECT employee_id FROM payroll_run_item WHERE run_id = r_run.id
      LOOP
        PERFORM recalculate_payroll_item(r_run.id, r_item.employee_id);
      END LOOP;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 13. Restore add_employee_to_pending_payroll_runs
CREATE OR REPLACE FUNCTION public.add_employee_to_pending_payroll_runs() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  r_run RECORD;
BEGIN
  FOR r_run IN SELECT id, period_start_date FROM payroll_run WHERE status = 'pending' AND deleted_at IS NULL
  LOOP
    IF NEW.employment_end_date IS NULL OR NEW.employment_end_date >= r_run.period_start_date THEN
      INSERT INTO payroll_run_item (run_id, employee_id, employee_type_id, created_by, updated_by)
      VALUES (r_run.id, NEW.id, NEW.employee_type_id, NEW.created_by, NEW.created_by)
      ON CONFLICT (run_id, employee_id) DO NOTHING;
      PERFORM recalculate_payroll_item(r_run.id, NEW.id);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- 14. Restore payroll_config_auto_close_prev
CREATE OR REPLACE FUNCTION payroll_config_auto_close_prev() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  start_date DATE;
BEGIN
  start_date := lower(NEW.effective_daterange);
  UPDATE payroll_config pc
  SET effective_daterange = CASE WHEN lower(pc.effective_daterange) < start_date THEN daterange(lower(pc.effective_daterange), start_date, '[)') ELSE pc.effective_daterange END,
      status = CASE WHEN pc.status = 'active' THEN 'retired' ELSE pc.status END,
      updated_at = now(), updated_by = NEW.updated_by
  WHERE pc.id <> NEW.id AND upper_inf(pc.effective_daterange);
  RETURN NEW;
END$$;

-- 15. Restore get_effective_payroll_config
DROP FUNCTION IF EXISTS get_effective_payroll_config(DATE, UUID);
CREATE OR REPLACE FUNCTION get_effective_payroll_config(p_period_month DATE) RETURNS payroll_config LANGUAGE sql AS $$
  SELECT pc.* FROM payroll_config pc
  WHERE pc.effective_daterange @> p_period_month
  ORDER BY lower(pc.effective_daterange) DESC, pc.version_no DESC LIMIT 1;
$$;

-- 16. Restore payroll_org_profile_auto_close_prev
CREATE OR REPLACE FUNCTION payroll_org_profile_auto_close_prev() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_start_date DATE;
BEGIN
  v_start_date := lower(NEW.effective_daterange);
  UPDATE payroll_org_profile p SET effective_daterange = daterange(lower(p.effective_daterange), v_start_date, '[)'), updated_at = now(), updated_by = NEW.updated_by WHERE p.id <> NEW.id AND upper_inf(p.effective_daterange) AND lower(p.effective_daterange) < v_start_date;
  RETURN NEW;
END$$;

-- 17. Restore payroll_org_profile_apply_to_pending_runs
CREATE OR REPLACE FUNCTION payroll_org_profile_apply_to_pending_runs() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  r_run RECORD;
  r_item RECORD;
BEGIN
  FOR r_run IN SELECT id, payroll_month_date FROM payroll_run WHERE status = 'pending' AND deleted_at IS NULL
  LOOP
    IF NEW.effective_daterange @> r_run.payroll_month_date THEN
      FOR r_item IN SELECT employee_id FROM payroll_run_item WHERE run_id = r_run.id
      LOOP
        PERFORM recalculate_payroll_item(r_run.id, r_item.employee_id);
      END LOOP;
    END IF;
  END LOOP;
  RETURN NEW;
END$$;

-- 18. Restore worklog_ft_sync_salary_raise_item
CREATE OR REPLACE FUNCTION public.worklog_ft_sync_salary_raise_item() RETURNS trigger AS $$
DECLARE
  v_cycle_id UUID;
BEGIN
  SELECT id INTO v_cycle_id FROM salary_raise_cycle WHERE status = 'draft' AND (COALESCE(NEW.work_date, OLD.work_date) BETWEEN period_start_date AND period_end_date) LIMIT 1;
  IF v_cycle_id IS NOT NULL THEN
    UPDATE salary_raise_item SET
      late_minutes = COALESCE((SELECT SUM(quantity)::INT FROM worklog_ft WHERE employee_id = COALESCE(NEW.employee_id, OLD.employee_id) AND entry_type = 'late' AND work_date BETWEEN (SELECT period_start_date FROM salary_raise_cycle WHERE id = v_cycle_id) AND (SELECT period_end_date FROM salary_raise_cycle WHERE id = v_cycle_id) AND deleted_at IS NULL AND status IN ('pending','approved')), 0),
      leave_days = COALESCE((SELECT SUM(quantity)::NUMERIC(6,2) FROM worklog_ft WHERE employee_id = COALESCE(NEW.employee_id, OLD.employee_id) AND entry_type = 'leave_day' AND work_date BETWEEN (SELECT period_start_date FROM salary_raise_cycle WHERE id = v_cycle_id) AND (SELECT period_end_date FROM salary_raise_cycle WHERE id = v_cycle_id) AND deleted_at IS NULL AND status IN ('pending','approved')), 0),
      leave_double_days = COALESCE((SELECT SUM(quantity)::NUMERIC(6,2) FROM worklog_ft WHERE employee_id = COALESCE(NEW.employee_id, OLD.employee_id) AND entry_type = 'leave_double' AND work_date BETWEEN (SELECT period_start_date FROM salary_raise_cycle WHERE id = v_cycle_id) AND (SELECT period_end_date FROM salary_raise_cycle WHERE id = v_cycle_id) AND deleted_at IS NULL AND status IN ('pending','approved')), 0),
      leave_hours = COALESCE((SELECT SUM(quantity)::NUMERIC(6,2) FROM worklog_ft WHERE employee_id = COALESCE(NEW.employee_id, OLD.employee_id) AND entry_type = 'leave_hours' AND work_date BETWEEN (SELECT period_start_date FROM salary_raise_cycle WHERE id = v_cycle_id) AND (SELECT period_end_date FROM salary_raise_cycle WHERE id = v_cycle_id) AND deleted_at IS NULL AND status IN ('pending','approved')), 0),
      ot_hours = COALESCE((SELECT SUM(quantity)::NUMERIC(6,2) FROM worklog_ft WHERE employee_id = COALESCE(NEW.employee_id, OLD.employee_id) AND entry_type = 'ot' AND work_date BETWEEN (SELECT period_start_date FROM salary_raise_cycle WHERE id = v_cycle_id) AND (SELECT period_end_date FROM salary_raise_cycle WHERE id = v_cycle_id) AND deleted_at IS NULL AND status IN ('pending','approved')), 0),
      updated_at = now()
    WHERE cycle_id = v_cycle_id AND employee_id = COALESCE(NEW.employee_id, OLD.employee_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 19. Restore salary_raise_sync_item_on_employee_pay
CREATE OR REPLACE FUNCTION public.salary_raise_sync_item_on_employee_pay() RETURNS trigger AS $$
BEGIN
  UPDATE salary_raise_item SET current_salary = NEW.base_pay_amount, current_sso_wage = NEW.sso_declared_wage, updated_at = now() WHERE employee_id = NEW.id AND EXISTS (SELECT 1 FROM salary_raise_cycle WHERE id = cycle_id AND status = 'draft');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 20. Restore worklog_ft_sync_bonus_item
CREATE OR REPLACE FUNCTION public.worklog_ft_sync_bonus_item() RETURNS trigger AS $$
DECLARE
  v_cycle_id UUID;
BEGIN
  SELECT id INTO v_cycle_id FROM bonus_cycle WHERE status = 'draft' AND (COALESCE(NEW.work_date, OLD.work_date) BETWEEN period_start_date AND period_end_date) LIMIT 1;
  IF v_cycle_id IS NOT NULL THEN
    UPDATE bonus_item SET
      late_minutes = COALESCE((SELECT SUM(quantity)::INT FROM worklog_ft WHERE employee_id = COALESCE(NEW.employee_id, OLD.employee_id) AND entry_type = 'late' AND work_date BETWEEN (SELECT period_start_date FROM bonus_cycle WHERE id = v_cycle_id) AND (SELECT period_end_date FROM bonus_cycle WHERE id = v_cycle_id) AND deleted_at IS NULL AND status IN ('pending','approved')), 0),
      leave_days = COALESCE((SELECT SUM(quantity)::NUMERIC(6,2) FROM worklog_ft WHERE employee_id = COALESCE(NEW.employee_id, OLD.employee_id) AND entry_type = 'leave_day' AND work_date BETWEEN (SELECT period_start_date FROM bonus_cycle WHERE id = v_cycle_id) AND (SELECT period_end_date FROM bonus_cycle WHERE id = v_cycle_id) AND deleted_at IS NULL AND status IN ('pending','approved')), 0),
      leave_double_days = COALESCE((SELECT SUM(quantity)::NUMERIC(6,2) FROM worklog_ft WHERE employee_id = COALESCE(NEW.employee_id, OLD.employee_id) AND entry_type = 'leave_double' AND work_date BETWEEN (SELECT period_start_date FROM bonus_cycle WHERE id = v_cycle_id) AND (SELECT period_end_date FROM bonus_cycle WHERE id = v_cycle_id) AND deleted_at IS NULL AND status IN ('pending','approved')), 0),
      leave_hours = COALESCE((SELECT SUM(quantity)::NUMERIC(6,2) FROM worklog_ft WHERE employee_id = COALESCE(NEW.employee_id, OLD.employee_id) AND entry_type = 'leave_hours' AND work_date BETWEEN (SELECT period_start_date FROM bonus_cycle WHERE id = v_cycle_id) AND (SELECT period_end_date FROM bonus_cycle WHERE id = v_cycle_id) AND deleted_at IS NULL AND status IN ('pending','approved')), 0),
      ot_hours = COALESCE((SELECT SUM(quantity)::NUMERIC(6,2) FROM worklog_ft WHERE employee_id = COALESCE(NEW.employee_id, OLD.employee_id) AND entry_type = 'ot' AND work_date BETWEEN (SELECT period_start_date FROM bonus_cycle WHERE id = v_cycle_id) AND (SELECT period_end_date FROM bonus_cycle WHERE id = v_cycle_id) AND deleted_at IS NULL AND status IN ('pending','approved')), 0),
      updated_at = now()
    WHERE cycle_id = v_cycle_id AND employee_id = COALESCE(NEW.employee_id, OLD.employee_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 21. Restore bonus_sync_item_on_employee_pay
CREATE OR REPLACE FUNCTION public.bonus_sync_item_on_employee_pay() RETURNS trigger AS $$
BEGIN
  UPDATE bonus_item SET current_salary = NEW.base_pay_amount, updated_at = now() WHERE employee_id = NEW.id AND EXISTS (SELECT 1 FROM bonus_cycle WHERE id = cycle_id AND status = 'draft');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 22. Restore get_effective_org_profile and payroll_run_apply_org_profile
-- Revert org profile scoping changes
-- =========================================

-- Restore payroll_run_apply_org_profile trigger function
CREATE OR REPLACE FUNCTION payroll_run_apply_org_profile()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_profile payroll_org_profile%ROWTYPE;
BEGIN
  IF NEW.org_profile_id IS NULL THEN
    -- Revert to global selection without company_id
    SELECT * INTO v_profile FROM get_effective_org_profile(NEW.payroll_month_date);
  ELSE
    SELECT * INTO v_profile FROM payroll_org_profile WHERE id = NEW.org_profile_id;
  END IF;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'ไม่พบ org profile สำหรับวันที่ %', NEW.payroll_month_date;
  END IF;

  IF NOT (v_profile.effective_daterange @> NEW.payroll_month_date) THEN
    RAISE EXCEPTION 'org profile % ไม่ครอบคลุมเดือนจ่าย %', v_profile.id, NEW.payroll_month_date;
  END IF;

  NEW.org_profile_id := v_profile.id;
  NEW.org_profile_snapshot := jsonb_build_object(
    'profile_id', v_profile.id,
    'version_no', v_profile.version_no,
    'effective_start', lower(v_profile.effective_daterange),
    'effective_end', upper(v_profile.effective_daterange),
    'company_name', v_profile.company_name,
    'address_line1', v_profile.address_line1,
    'address_line2', v_profile.address_line2,
    'subdistrict', v_profile.subdistrict,
    'district', v_profile.district,
    'province', v_profile.province,
    'postal_code', v_profile.postal_code,
    'phone_main', v_profile.phone_main,
    'phone_alt', v_profile.phone_alt,
    'email', v_profile.email,
    'tax_id', v_profile.tax_id,
    'slip_footer_note', v_profile.slip_footer_note,
    'logo_id', v_profile.logo_id
  );

  RETURN NEW;
END$$;

-- Revert get_effective_org_profile to single parameter
DROP FUNCTION IF EXISTS get_effective_org_profile(DATE, UUID);
CREATE OR REPLACE FUNCTION get_effective_org_profile(
  p_period_month DATE
) RETURNS payroll_org_profile LANGUAGE sql AS $$
  SELECT p.*
  FROM payroll_org_profile p
  WHERE p.effective_daterange @> p_period_month
  ORDER BY lower(p.effective_daterange) DESC, p.version_no DESC
  LIMIT 1;
$$;

-- =============================================
-- Restore Unique Indexes (Removing company_id/branch_id from UK)
-- =============================================
DROP INDEX IF EXISTS salary_raise_cycle_period_tenant_uk;
DROP INDEX IF EXISTS salary_raise_cycle_period_uk;
CREATE UNIQUE INDEX salary_raise_cycle_period_uk ON salary_raise_cycle (period_start_date, period_end_date) WHERE (deleted_at IS NULL);

DROP INDEX IF EXISTS bonus_cycle_period_tenant_uk;
DROP INDEX IF EXISTS bonus_cycle_period_uk;
CREATE UNIQUE INDEX bonus_cycle_period_uk ON bonus_cycle (period_start_date, period_end_date) WHERE (deleted_at IS NULL);
