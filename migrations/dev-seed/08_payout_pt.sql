-- Dev seed: Create PT Payouts for Part-time employees
BEGIN;

DO $$
DECLARE
  v_admin_id UUID;
  v_admin2_id UUID;
  v_emp RECORD;
  v_wl_id UUID;
  v_payout1_id UUID;
  v_payout2_id UUID;
  v_counter INT;
BEGIN
  SELECT id INTO v_admin_id FROM users WHERE username = 'admin' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_admin2_id FROM users WHERE username = 'admin2' AND deleted_at IS NULL LIMIT 1;

  RAISE NOTICE 'Seeding Payout PT data...';

  -- Loop through each PT employee
  FOR v_emp IN 
    SELECT e.id, e.employee_number, e.company_id, e.branch_id, e.base_pay_amount,
           CASE WHEN c.code = 'DEFAULT' THEN v_admin_id ELSE v_admin2_id END as creator_id
    FROM employees e
    JOIN companies c ON c.id = e.company_id
    JOIN employee_type t ON t.id = e.employee_type_id
    WHERE t.code = 'part_time' AND e.deleted_at IS NULL
  LOOP
    -- 1. Create a payout with 'to_pay' status for some approved worklogs
    v_payout1_id := uuidv7();
    
    INSERT INTO payout_pt (
      id, employee_id, company_id, branch_id, status, hourly_rate_used, created_by, updated_by
    ) VALUES (
      v_payout1_id, v_emp.id, v_emp.company_id, v_emp.branch_id, 'to_pay', v_emp.base_pay_amount, v_emp.creator_id, v_emp.creator_id
    );

    -- Attach first 5 approved worklogs to this payout
    v_counter := 0;
    FOR v_wl_id IN 
      SELECT id FROM worklog_pt 
      WHERE employee_id = v_emp.id AND status = 'approved' AND deleted_at IS NULL
      LIMIT 5
    LOOP
      INSERT INTO payout_pt_item (payout_id, worklog_id, company_id, branch_id)
      VALUES (v_payout1_id, v_wl_id, v_emp.company_id, v_emp.branch_id);
      v_counter := v_counter + 1;
    END LOOP;

    -- 2. Create another payout and mark it as 'paid' for some employees
    IF v_emp.employee_number LIKE '%001%' OR v_emp.employee_number LIKE '%101%' THEN
      v_payout2_id := uuidv7();
      
      INSERT INTO payout_pt (
        id, employee_id, company_id, branch_id, status, hourly_rate_used, created_by, updated_by
      ) VALUES (
        v_payout2_id, v_emp.id, v_emp.company_id, v_emp.branch_id, 'to_pay', v_emp.base_pay_amount, v_emp.creator_id, v_emp.creator_id
      );

      -- Attach next 5 approved worklogs (skip the first 5 already used)
      v_counter := 0;
      FOR v_wl_id IN 
        SELECT id FROM worklog_pt 
        WHERE employee_id = v_emp.id AND status = 'approved' AND deleted_at IS NULL
        OFFSET 5 LIMIT 5
      LOOP
        INSERT INTO payout_pt_item (payout_id, worklog_id, company_id, branch_id)
        VALUES (v_payout2_id, v_wl_id, v_emp.company_id, v_emp.branch_id);
        v_counter := v_counter + 1;
      END LOOP;

      -- Mark as paid
      IF v_counter > 0 THEN
        UPDATE payout_pt 
        SET status = 'paid', paid_at = now() - interval '1 day', paid_by = v_emp.creator_id
        WHERE id = v_payout2_id;
      ELSE
        -- If no more worklogs, delete the empty payout
        DELETE FROM payout_pt WHERE id = v_payout2_id;
      END IF;
    END IF;

  END LOOP;

  RAISE NOTICE 'Seeding Payout PT data completed.';
END $$;

COMMIT;
