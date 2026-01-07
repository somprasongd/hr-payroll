-- Seed test data for PT Payout tests
-- Creates:
-- 1. PT worklogs with approved status for PT-001, PT-002
-- 2. PT payouts with 'to_pay' and 'paid' status
-- 
-- Used by tests:
-- - 09-pt-payout.spec.ts

BEGIN;

DO $$
DECLARE
  v_admin_id UUID;
  v_emp RECORD;
  v_work_date DATE;
  v_day_counter INT;
  v_payout_pending_id UUID;
  v_payout_paid_id UUID;
  v_wl_id UUID;
  v_counter INT;
BEGIN
  SELECT id INTO v_admin_id FROM users WHERE username = 'admin' AND deleted_at IS NULL LIMIT 1;
  
  -- Loop through PT employees (PT-001, PT-002)
  FOR v_emp IN 
    SELECT e.id, e.employee_number, e.company_id, e.branch_id, e.base_pay_amount
    FROM employees e
    JOIN employee_type t ON t.id = e.employee_type_id
    WHERE t.code = 'part_time' 
      AND e.employee_number IN ('PT-001', 'PT-002')
      AND e.deleted_at IS NULL
  LOOP
    -- 1. Create approved PT worklogs for this employee (at least 10 entries)
    v_work_date := date_trunc('month', CURRENT_DATE)::date;
    v_day_counter := 0;
    
    WHILE v_day_counter < 15 LOOP
      -- Skip weekends
      IF EXTRACT(DOW FROM v_work_date) NOT IN (0, 6) THEN
        INSERT INTO worklog_pt (
          employee_id, work_date,
          morning_in, morning_out, evening_in, evening_out,
          status, created_by, updated_by
        ) VALUES (
          v_emp.id, v_work_date,
          '08:30'::time, '12:30'::time, '13:00'::time, '17:00'::time,
          'approved',
          v_admin_id, v_admin_id
        ) ON CONFLICT (employee_id, work_date) WHERE deleted_at IS NULL DO NOTHING;
        
        v_day_counter := v_day_counter + 1;
      END IF;
      
      v_work_date := v_work_date + interval '1 day';
    END LOOP;
    
    -- 2. Create a payout with 'to_pay' status
    v_payout_pending_id := gen_random_uuid();
    
    INSERT INTO payout_pt (
      id, employee_id, company_id, branch_id, status, hourly_rate_used, created_by, updated_by
    ) VALUES (
      v_payout_pending_id, v_emp.id, v_emp.company_id, v_emp.branch_id, 'to_pay', v_emp.base_pay_amount, v_admin_id, v_admin_id
    ) ON CONFLICT DO NOTHING;
    
    -- Attach first 5 approved worklogs to this pending payout
    v_counter := 0;
    FOR v_wl_id IN 
      SELECT id FROM worklog_pt 
      WHERE employee_id = v_emp.id AND status = 'approved' AND deleted_at IS NULL
      LIMIT 5
    LOOP
      INSERT INTO payout_pt_item (payout_id, worklog_id, company_id, branch_id)
      VALUES (v_payout_pending_id, v_wl_id, v_emp.company_id, v_emp.branch_id)
      ON CONFLICT DO NOTHING;
      v_counter := v_counter + 1;
    END LOOP;
    
    -- 3. Create a payout with 'paid' status for PT-001 only
    IF v_emp.employee_number = 'PT-001' THEN
      v_payout_paid_id := gen_random_uuid();
      
      INSERT INTO payout_pt (
        id, employee_id, company_id, branch_id, status, hourly_rate_used, 
        paid_at, paid_by, created_by, updated_by
      ) VALUES (
        v_payout_paid_id, v_emp.id, v_emp.company_id, v_emp.branch_id, 'paid', 
        v_emp.base_pay_amount, now() - interval '1 day', v_admin_id, v_admin_id, v_admin_id
      ) ON CONFLICT DO NOTHING;
      
      -- Attach next 5 approved worklogs (skip the first 5 already used)
      v_counter := 0;
      FOR v_wl_id IN 
        SELECT id FROM worklog_pt 
        WHERE employee_id = v_emp.id AND status = 'approved' AND deleted_at IS NULL
        OFFSET 5 LIMIT 5
      LOOP
        INSERT INTO payout_pt_item (payout_id, worklog_id, company_id, branch_id)
        VALUES (v_payout_paid_id, v_wl_id, v_emp.company_id, v_emp.branch_id)
        ON CONFLICT DO NOTHING;
        v_counter := v_counter + 1;
      END LOOP;
    END IF;
    
  END LOOP;

  RAISE NOTICE 'Created PT worklogs and payouts for PT-001 and PT-002';
END $$;

COMMIT;
