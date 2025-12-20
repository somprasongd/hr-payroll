-- Dev seed: Create bonus cycles and salary raise cycles
BEGIN;

DO $$
DECLARE
  v_admin_id UUID;
  v_admin2_id UUID;
  v_default_company_id UUID;
  v_company2_id UUID;
  v_default_hq_id UUID;
  v_company2_hq_id UUID;
  v_current_month DATE;
  v_period_start DATE;
  v_period_end DATE;
  v_cycle_id UUID;
  v_sal_cycle_id UUID;
  v_emp RECORD;
BEGIN
  SELECT id INTO v_admin_id FROM users WHERE username = 'admin' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_admin2_id FROM users WHERE username = 'admin2' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_default_company_id FROM companies WHERE code = 'DEFAULT' LIMIT 1;
  SELECT id INTO v_company2_id FROM companies WHERE code = 'COMPANY2' LIMIT 1;
  
  -- Get default branches
  SELECT id INTO v_default_hq_id FROM branches WHERE company_id = v_default_company_id AND is_default = TRUE LIMIT 1;
  SELECT id INTO v_company2_hq_id FROM branches WHERE company_id = v_company2_id AND is_default = TRUE LIMIT 1;
  
  v_current_month := date_trunc('month', CURRENT_DATE)::date;
  v_period_start := v_current_month;
  v_period_end := (v_current_month + interval '1 month' - interval '1 day')::date;

  -- =====================================================
  -- BONUS CYCLES (Pending for ALL branches)
  -- =====================================================
  
  FOR v_emp IN (
    SELECT b.id, b.company_id 
    FROM branches b
    JOIN companies c ON c.id = b.company_id
    WHERE b.deleted_at IS NULL AND c.code IN ('DEFAULT', 'COMPANY2')
  ) LOOP
    v_cycle_id := NULL;
    
    -- Check if pending cycle already exists for this branch
    SELECT id INTO v_cycle_id FROM bonus_cycle 
    WHERE branch_id = v_emp.id AND status = 'pending' AND deleted_at IS NULL LIMIT 1;

    IF v_cycle_id IS NULL THEN
      INSERT INTO bonus_cycle (
        company_id, branch_id,
        payroll_month_date, period_start_date, period_end_date,
        bonus_year, status, created_by, updated_by
      ) VALUES (
        v_emp.company_id, v_emp.id,
        v_current_month, v_period_start, v_period_end,
        EXTRACT(YEAR FROM v_current_month)::INT, 'pending',
        CASE WHEN v_emp.company_id = v_default_company_id THEN v_admin_id ELSE v_admin2_id END,
        CASE WHEN v_emp.company_id = v_default_company_id THEN v_admin_id ELSE v_admin2_id END
      )
      RETURNING id INTO v_cycle_id;
      
      -- Update bonus_item for some employees to have different bonus months
      UPDATE bonus_item SET
        bonus_months = 1.5,
        bonus_amount = current_salary * 1.5
      WHERE cycle_id = v_cycle_id AND employee_id IN (
        SELECT id FROM employees WHERE branch_id = v_emp.id AND employee_number LIKE '%001'
      );
      
      RAISE NOTICE 'Created pending bonus cycle for branch: %', v_emp.id;
    ELSE
      RAISE NOTICE 'Pending bonus cycle already exists for branch: %', v_emp.id;
    END IF;
  END LOOP;

  -- =====================================================
  -- SALARY RAISE CYCLES (Pending for ALL branches)
  -- =====================================================
  
  FOR v_emp IN (
    SELECT b.id, b.company_id 
    FROM branches b
    JOIN companies c ON c.id = b.company_id
    WHERE b.deleted_at IS NULL AND c.code IN ('DEFAULT', 'COMPANY2')
  ) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM salary_raise_cycle 
      WHERE branch_id = v_emp.id AND status = 'pending' AND deleted_at IS NULL
    ) THEN
      INSERT INTO salary_raise_cycle (
        company_id, branch_id, period_start_date, period_end_date, 
        status, created_by, updated_by
      ) VALUES (
        v_emp.company_id, v_emp.id,
        v_period_start, v_period_end, 'pending',
        CASE WHEN v_emp.company_id = v_default_company_id THEN v_admin_id ELSE v_admin2_id END,
        CASE WHEN v_emp.company_id = v_default_company_id THEN v_admin_id ELSE v_admin2_id END
      );
      RAISE NOTICE 'Created pending salary raise cycle for branch: %', v_emp.id;
    ELSE
      RAISE NOTICE 'Pending salary raise cycle already exists for branch: %', v_emp.id;
    END IF;
  END LOOP;

END $$;

COMMIT;
