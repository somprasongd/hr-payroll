-- Dev seed cleanup: Remove all seeded data for fresh start
BEGIN;

-- Activity logs
DELETE FROM activity_logs WHERE 1=1;

-- Payroll items and runs
DELETE FROM payroll_run_item WHERE 1=1;
DELETE FROM payroll_run WHERE 1=1;

-- Payout PT items and payouts
DELETE FROM payout_pt_item WHERE 1=1;
DELETE FROM payout_pt WHERE 1=1;

-- Bonus items and cycles
DELETE FROM bonus_item WHERE 1=1;
DELETE FROM bonus_cycle WHERE 1=1;

-- Salary raise items and cycles
DELETE FROM salary_raise_item WHERE 1=1;
DELETE FROM salary_raise_cycle WHERE 1=1;

-- Debt transactions
DELETE FROM debt_txn WHERE 1=1;

-- Salary advance
DELETE FROM salary_advance WHERE 1=1;

-- Worklog records
DELETE FROM worklog_ft WHERE 1=1;
DELETE FROM worklog_pt WHERE 1=1;

-- Employee documents
DELETE FROM employee_document WHERE 1=1;

-- Payroll accumulation
DELETE FROM payroll_accumulation WHERE 1=1;

-- Employees
DELETE FROM employees WHERE 1=1;

-- Departments and positions
DELETE FROM department WHERE 1=1;
DELETE FROM employee_position WHERE 1=1;

-- Document types (Corrected table name)
DELETE FROM employee_document_type WHERE 1=1;

-- User access
DELETE FROM user_branch_access WHERE user_id NOT IN (
  SELECT id FROM users WHERE username IN ('admin', 'superadmin')
);

COMMIT;
