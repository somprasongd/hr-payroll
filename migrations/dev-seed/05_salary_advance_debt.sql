-- Dev seed: Create salary advance, debt transactions for employees
BEGIN;

DO $$
DECLARE
  v_admin_id UUID;
  v_admin2_id UUID;
  v_emp RECORD;
  v_current_month DATE;
  v_debt_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM users WHERE username = 'admin' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_admin2_id FROM users WHERE username = 'admin2' AND deleted_at IS NULL LIMIT 1;
  v_current_month := date_trunc('month', CURRENT_DATE)::date;

  -- =====================================================
  -- SALARY ADVANCE
  -- =====================================================
  FOR v_emp IN 
    SELECT e.id, e.employee_number, e.company_id, e.branch_id,
           CASE WHEN c.code = 'DEFAULT' THEN v_admin_id ELSE v_admin2_id END as creator_id
    FROM employees e
    JOIN companies c ON c.id = e.company_id
    JOIN employee_type t ON t.id = e.employee_type_id
    WHERE t.code = 'full_time' 
      AND e.deleted_at IS NULL
      AND (position('001' in e.employee_number) > 0 OR position('002' in e.employee_number) > 0 OR position('101' in e.employee_number) > 0)
  LOOP
    INSERT INTO salary_advance (
      employee_id, company_id, branch_id, payroll_month_date, 
      advance_date, amount, status, 
      created_by, updated_by
    ) VALUES (
      v_emp.id, v_emp.company_id, v_emp.branch_id, v_current_month,
      (v_current_month + interval '5 days')::date,
      CASE 
        WHEN position('001' in v_emp.employee_number) > 0 THEN 5000.00
        WHEN position('002' in v_emp.employee_number) > 0 THEN 3000.00
        ELSE 2000.00
      END,
      'pending',
      v_emp.creator_id, v_emp.creator_id
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  -- =====================================================
  -- DEBT TRANSACTIONS
  -- =====================================================
  FOR v_emp IN 
    SELECT e.id, e.employee_number, e.company_id, e.branch_id,
           CASE WHEN c.code = 'DEFAULT' THEN v_admin_id ELSE v_admin2_id END as creator_id
    FROM employees e
    JOIN companies c ON c.id = e.company_id
    JOIN employee_type t ON t.id = e.employee_type_id
    WHERE t.code = 'full_time' 
      AND e.deleted_at IS NULL
      AND (position('FT-001' in e.employee_number) > 0 OR position('C2-FT-001' in e.employee_number) > 0)
  LOOP
    -- 1. Create loan as PENDING (to allow installments)
    INSERT INTO debt_txn (
      employee_id, company_id, branch_id, txn_type, txn_date, amount, 
      reason, status, created_by, updated_by
    ) VALUES (
      v_emp.id, v_emp.company_id, v_emp.branch_id, 
      'loan', 
      (v_current_month - interval '2 months')::date,
      CASE 
        WHEN position('FT-001' in v_emp.employee_number) > 0 THEN 30000.00
        ELSE 25000.00
      END,
      'กู้ยืมเงินทุนการศึกษาบุตร',
      'pending',
      v_emp.creator_id, v_emp.creator_id
    ) RETURNING id INTO v_debt_id;
    
    -- 2. Create previous month repayment (Already approved)
    INSERT INTO debt_txn (
      employee_id, company_id, branch_id, txn_type, txn_date, 
      amount, 
      reason, status, created_by, updated_by
    ) VALUES (
      v_emp.id, v_emp.company_id, v_emp.branch_id, 
      'repayment', 
      (v_current_month - interval '1 month')::date,
      CASE 
        WHEN position('FT-001' in v_emp.employee_number) > 0 THEN 5000.00
        ELSE 4000.00
      END,
      'ชำระหนี้งวดที่ 1',
      'approved',
      v_emp.creator_id, v_emp.creator_id
    );

    -- 3. Create current month installment (Pending)
    INSERT INTO debt_txn (
      employee_id, company_id, branch_id, txn_type, txn_date, 
      payroll_month_date, amount, parent_id,
      reason, status, created_by, updated_by
    ) VALUES (
      v_emp.id, v_emp.company_id, v_emp.branch_id, 
      'installment', 
      v_current_month,
      v_current_month,
      CASE 
        WHEN position('FT-001' in v_emp.employee_number) > 0 THEN 5000.00
        ELSE 4000.00
      END,
      v_debt_id,
      'หักเงินคืนงวดปัจจุบัน',
      'pending',
      v_emp.creator_id, v_emp.creator_id
    );
    
    -- 4. Now approve the loan
    UPDATE debt_txn SET status = 'approved' WHERE id = v_debt_id;
    
  END LOOP;

  RAISE NOTICE 'Created salary advance and debt transaction records';
END $$;

COMMIT;
