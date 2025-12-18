-- =========================================
-- Rollback: RLS Policies
-- =========================================

-- Drop policies
DROP POLICY IF EXISTS tenant_isolation_employees ON employees;
DROP POLICY IF EXISTS tenant_isolation_department ON department;
DROP POLICY IF EXISTS tenant_isolation_employee_position ON employee_position;
DROP POLICY IF EXISTS tenant_isolation_payroll_config ON payroll_config;
DROP POLICY IF EXISTS tenant_isolation_payroll_run ON payroll_run;
DROP POLICY IF EXISTS tenant_isolation_payroll_run_item ON payroll_run_item;
DROP POLICY IF EXISTS tenant_isolation_payroll_accumulation ON payroll_accumulation;
DROP POLICY IF EXISTS tenant_isolation_worklog_ft ON worklog_ft;
DROP POLICY IF EXISTS tenant_isolation_worklog_pt ON worklog_pt;
DROP POLICY IF EXISTS tenant_isolation_payout_pt ON payout_pt;
DROP POLICY IF EXISTS tenant_isolation_salary_advance ON salary_advance;
DROP POLICY IF EXISTS tenant_isolation_debt_txn ON debt_txn;
DROP POLICY IF EXISTS tenant_isolation_bonus_cycle ON bonus_cycle;
DROP POLICY IF EXISTS tenant_isolation_bonus_item ON bonus_item;
DROP POLICY IF EXISTS tenant_isolation_salary_raise_cycle ON salary_raise_cycle;
DROP POLICY IF EXISTS tenant_isolation_salary_raise_item ON salary_raise_item;
DROP POLICY IF EXISTS tenant_isolation_payout_pt_item ON payout_pt_item;
-- Users RLS is currently disabled in up migration
-- DROP POLICY IF EXISTS tenant_isolation_users ON users;

-- Disable RLS
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE department DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee_position DISABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_run DISABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_run_item DISABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_accumulation DISABLE ROW LEVEL SECURITY;
ALTER TABLE worklog_ft DISABLE ROW LEVEL SECURITY;
ALTER TABLE worklog_pt DISABLE ROW LEVEL SECURITY;
ALTER TABLE payout_pt DISABLE ROW LEVEL SECURITY;
ALTER TABLE salary_advance DISABLE ROW LEVEL SECURITY;
ALTER TABLE debt_txn DISABLE ROW LEVEL SECURITY;
ALTER TABLE bonus_cycle DISABLE ROW LEVEL SECURITY;
ALTER TABLE bonus_item DISABLE ROW LEVEL SECURITY;
ALTER TABLE salary_raise_cycle DISABLE ROW LEVEL SECURITY;
ALTER TABLE salary_raise_item DISABLE ROW LEVEL SECURITY;
-- Users RLS is currently disabled
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payout_pt_item') THEN
    ALTER TABLE payout_pt_item DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payroll_org_profile') THEN
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_payroll_org_profile ON payroll_org_profile';
    ALTER TABLE payroll_org_profile DISABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payroll_org_logo') THEN
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_payroll_org_logo ON payroll_org_logo';
    ALTER TABLE payroll_org_logo DISABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_log') THEN
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_activity_log ON activity_log';
    ALTER TABLE activity_log DISABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employee_document') THEN
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_employee_document ON employee_document';
    ALTER TABLE employee_document DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Drop helper functions
DROP FUNCTION IF EXISTS tenant_branch_allowed(UUID);
DROP FUNCTION IF EXISTS tenant_company_matches(UUID);
DROP FUNCTION IF EXISTS is_superadmin();
