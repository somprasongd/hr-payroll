-- Dev seed: Create worklogs for all employees (December 2025)
-- Uses dynamic date calculation for current month
BEGIN;

DO $$
DECLARE
  v_admin_id UUID;
  v_admin2_id UUID;
  v_emp RECORD;
  v_current_month_start DATE;
  v_current_month_end DATE;
  v_work_date DATE;
  v_day_counter INT;
  v_random_val FLOAT;
  v_has_late BOOLEAN;
  v_has_leave BOOLEAN;
  v_has_ot BOOLEAN;
BEGIN
  SELECT id INTO v_admin_id FROM users WHERE username = 'admin' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_admin2_id FROM users WHERE username = 'admin2' AND deleted_at IS NULL LIMIT 1;
  
  -- Calculate current month range
  v_current_month_start := date_trunc('month', CURRENT_DATE)::date;
  v_current_month_end := (v_current_month_start + interval '1 month' - interval '1 day')::date;
  
  RAISE NOTICE 'Creating worklogs for period: % to %', v_current_month_start, v_current_month_end;

  -- =====================================================
  -- FULL-TIME WORKLOGS (worklog_ft)
  -- =====================================================
  FOR v_emp IN 
    SELECT e.id, e.employee_number, e.company_id, e.branch_id,
           CASE WHEN c.code = 'DEFAULT' THEN v_admin_id ELSE v_admin2_id END as creator_id
    FROM employees e
    JOIN companies c ON c.id = e.company_id
    JOIN employee_type t ON t.id = e.employee_type_id
    WHERE t.code = 'full_time' AND e.deleted_at IS NULL
  LOOP
    -- Decide which types of worklog this employee will have (variety)
    v_random_val := random();
    v_has_late := (v_random_val > 0.3); -- 70% have late
    v_has_leave := (v_random_val > 0.4); -- 60% have leave
    v_has_ot := (v_random_val > 0.5); -- 50% have OT
    
    -- Some employees have all types, some have partial
    IF position('001' in v_emp.employee_number) > 0 THEN
      v_has_late := TRUE; v_has_leave := TRUE; v_has_ot := TRUE;
    ELSIF position('002' in v_emp.employee_number) > 0 THEN
      v_has_late := TRUE; v_has_leave := FALSE; v_has_ot := TRUE;
    ELSIF position('003' in v_emp.employee_number) > 0 THEN
      v_has_late := FALSE; v_has_leave := TRUE; v_has_ot := FALSE;
    END IF;
    
    -- Generate worklogs across the month
    v_day_counter := 1;
    v_work_date := v_current_month_start;
    
    WHILE v_work_date <= v_current_month_end AND v_day_counter <= 25 LOOP
      -- Skip weekends
      IF EXTRACT(DOW FROM v_work_date) NOT IN (0, 6) THEN
        
        -- Late entries (on days 3, 8, 13, 18, 23)
        IF v_has_late AND (v_day_counter IN (3, 8, 13, 18, 23)) THEN
          INSERT INTO worklog_ft (
            employee_id, entry_type, work_date, quantity, status, created_by, updated_by
          ) VALUES (
            v_emp.id, 'late', v_work_date, 
            (ARRAY[5, 10, 15, 20, 30])[floor(random() * 5 + 1)::int], -- Random minutes
            CASE WHEN random() > 0.3 THEN 'approved' ELSE 'pending' END,
            v_emp.creator_id, v_emp.creator_id
          ) ON CONFLICT DO NOTHING;
        END IF;
        
        -- Leave day entries (on days 5, 12, 19)
        IF v_has_leave AND v_day_counter IN (5, 12, 19) THEN
          INSERT INTO worklog_ft (
            employee_id, entry_type, work_date, quantity, status, created_by, updated_by
          ) VALUES (
            v_emp.id, 'leave_day', v_work_date, 1, 
            CASE WHEN random() > 0.4 THEN 'approved' ELSE 'pending' END,
            v_emp.creator_id, v_emp.creator_id
          ) ON CONFLICT DO NOTHING;
        END IF;
        
        -- Leave double entries (on day 7)
        IF v_has_leave AND v_day_counter = 7 THEN
          INSERT INTO worklog_ft (
            employee_id, entry_type, work_date, quantity, status, created_by, updated_by
          ) VALUES (
            v_emp.id, 'leave_double', v_work_date, 1, 'pending',
            v_emp.creator_id, v_emp.creator_id
          ) ON CONFLICT DO NOTHING;
        END IF;
        
        -- Leave hours entries (on days 10, 17)
        IF v_has_leave AND v_day_counter IN (10, 17) THEN
          INSERT INTO worklog_ft (
            employee_id, entry_type, work_date, quantity, status, created_by, updated_by
          ) VALUES (
            v_emp.id, 'leave_hours', v_work_date, 
            (ARRAY[1, 2, 3, 4])[floor(random() * 4 + 1)::int],
            'approved',
            v_emp.creator_id, v_emp.creator_id
          ) ON CONFLICT DO NOTHING;
        END IF;
        
        -- OT entries (on days 2, 6, 11, 16, 21)
        IF v_has_ot AND v_day_counter IN (2, 6, 11, 16, 21) THEN
          INSERT INTO worklog_ft (
            employee_id, entry_type, work_date, quantity, status, created_by, updated_by
          ) VALUES (
            v_emp.id, 'ot', v_work_date, 
            (ARRAY[1.0, 1.5, 2.0, 2.5, 3.0])[floor(random() * 5 + 1)::int],
            CASE WHEN random() > 0.2 THEN 'approved' ELSE 'pending' END,
            v_emp.creator_id, v_emp.creator_id
          ) ON CONFLICT DO NOTHING;
        END IF;
        
        v_day_counter := v_day_counter + 1;
      END IF;
      
      v_work_date := v_work_date + interval '1 day';
    END LOOP;
    
  END LOOP;

  -- =====================================================
  -- PART-TIME WORKLOGS (worklog_pt)
  -- =====================================================
  FOR v_emp IN 
    SELECT e.id, e.employee_number, e.company_id, e.branch_id,
           CASE WHEN c.code = 'DEFAULT' THEN v_admin_id ELSE v_admin2_id END as creator_id
    FROM employees e
    JOIN companies c ON c.id = e.company_id
    JOIN employee_type t ON t.id = e.employee_type_id
    WHERE t.code = 'part_time' AND e.deleted_at IS NULL
  LOOP
    v_day_counter := 1;
    v_work_date := v_current_month_start;
    
    WHILE v_work_date <= v_current_month_end AND v_day_counter <= 20 LOOP
      -- Skip weekends for most, but some PT work weekends
      IF EXTRACT(DOW FROM v_work_date) NOT IN (0, 6) OR 
         (position('001' in v_emp.employee_number) > 0 AND EXTRACT(DOW FROM v_work_date) = 6) THEN
        
        -- Different work patterns based on employee
        IF position('001' in v_emp.employee_number) > 0 THEN
          -- PT-001: Morning only most days
          INSERT INTO worklog_pt (
            employee_id, work_date,
            morning_in, morning_out, evening_in, evening_out,
            status, created_by, updated_by
          ) VALUES (
            v_emp.id, v_work_date,
            '08:30'::time, '12:30'::time, NULL, NULL,
            CASE WHEN random() > 0.3 THEN 'approved' ELSE 'pending' END,
            v_emp.creator_id, v_emp.creator_id
          ) ON CONFLICT DO NOTHING;
          
        ELSIF position('002' in v_emp.employee_number) > 0 THEN
          -- PT-002: Evening only most days
          INSERT INTO worklog_pt (
            employee_id, work_date,
            morning_in, morning_out, evening_in, evening_out,
            status, created_by, updated_by
          ) VALUES (
            v_emp.id, v_work_date,
            NULL, NULL, '13:00'::time, '18:00'::time,
            'approved',
            v_emp.creator_id, v_emp.creator_id
          ) ON CONFLICT DO NOTHING;
          
        ELSIF position('101' in v_emp.employee_number) > 0 THEN
          -- PT-101: Full day
          INSERT INTO worklog_pt (
            employee_id, work_date,
            morning_in, morning_out, evening_in, evening_out,
            status, created_by, updated_by
          ) VALUES (
            v_emp.id, v_work_date,
            '09:00'::time, '12:00'::time, '13:00'::time, '17:00'::time,
            CASE WHEN v_day_counter % 3 = 0 THEN 'pending' ELSE 'approved' END,
            v_emp.creator_id, v_emp.creator_id
          ) ON CONFLICT DO NOTHING;
          
        ELSE
          -- PT-102: Variable hours
          INSERT INTO worklog_pt (
            employee_id, work_date,
            morning_in, morning_out, evening_in, evening_out,
            status, created_by, updated_by
          ) VALUES (
            v_emp.id, v_work_date,
            CASE WHEN random() > 0.5 THEN '08:00'::time ELSE '09:00'::time END,
            CASE WHEN random() > 0.5 THEN '12:00'::time ELSE '11:30'::time END,
            CASE WHEN random() > 0.3 THEN '13:30'::time ELSE NULL END,
            CASE WHEN random() > 0.3 THEN '16:30'::time ELSE NULL END,
            'pending',
            v_emp.creator_id, v_emp.creator_id
          ) ON CONFLICT DO NOTHING;
        END IF;
        
        v_day_counter := v_day_counter + 1;
      END IF;
      
      v_work_date := v_work_date + interval '1 day';
    END LOOP;
    
  END LOOP;

  RAISE NOTICE 'Created worklogs for FT and PT employees';
END $$;

COMMIT;
