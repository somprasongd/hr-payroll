-- =========================================
-- Multi-Branch Support - RLS Policies & Helper Functions
-- 
-- Consolidated from:
-- - 20251217215348_enable_rls_policies
-- - 20251221000000_scope_pending_cycle_to_branch (RLS policies only)
-- =========================================

-- ===== Helper function to check if current user is superadmin =====
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  v_user_role := current_setting('app.user_role', true);
  RETURN v_user_role = 'superadmin';
END;
$$;

-- ===== Helper function to check array containment for branch access =====
CREATE OR REPLACE FUNCTION tenant_branch_allowed(p_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_allowed_branches TEXT;
  v_is_admin BOOLEAN;
BEGIN
  -- Superadmin bypasses all RLS
  IF is_superadmin() THEN
    RETURN TRUE;
  END IF;

  -- Get current settings
  v_is_admin := COALESCE(current_setting('app.is_admin', true)::boolean, false);
  
  -- Admin can access all branches in their company
  IF v_is_admin THEN
    RETURN TRUE;
  END IF;
  
  -- Check if branch is in allowed list
  v_allowed_branches := current_setting('app.allowed_branches', true);
  IF v_allowed_branches IS NULL OR v_allowed_branches = '' THEN
    RETURN FALSE;
  END IF;
  
  RETURN p_branch_id = ANY(string_to_array(v_allowed_branches, ',')::uuid[]);
END;
$$;

-- ===== Helper function to check company access =====
CREATE OR REPLACE FUNCTION tenant_company_matches(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_current_company TEXT;
BEGIN
  -- Superadmin bypasses all RLS
  IF is_superadmin() THEN
    RETURN TRUE;
  END IF;

  v_current_company := current_setting('app.current_company_id', true);
  IF v_current_company IS NULL OR v_current_company = '' THEN
    RETURN FALSE;
  END IF;
  
  RETURN p_company_id = v_current_company::uuid;
END;
$$;

-- ===== 1) Employees =====
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_employees ON employees;
CREATE POLICY tenant_isolation_employees ON employees
  USING (
    tenant_company_matches(company_id) 
    AND tenant_branch_allowed(branch_id)
  );

-- ===== 2) Department =====
ALTER TABLE department ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_department ON department;
CREATE POLICY tenant_isolation_department ON department
  USING (tenant_company_matches(company_id));

-- ===== 3) Employee Position =====
ALTER TABLE employee_position ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_employee_position ON employee_position;
CREATE POLICY tenant_isolation_employee_position ON employee_position
  USING (tenant_company_matches(company_id));

-- ===== 4) Payroll Config =====
ALTER TABLE payroll_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_payroll_config ON payroll_config;
CREATE POLICY tenant_isolation_payroll_config ON payroll_config
  USING (tenant_company_matches(company_id));

-- ===== 5) Payroll Run =====
ALTER TABLE payroll_run ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_payroll_run ON payroll_run;
CREATE POLICY tenant_isolation_payroll_run ON payroll_run
  USING (
    tenant_company_matches(company_id) 
    AND tenant_branch_allowed(branch_id)
  );

-- ===== 6) Payroll Run Item =====
ALTER TABLE payroll_run_item ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_payroll_run_item ON payroll_run_item;
CREATE POLICY tenant_isolation_payroll_run_item ON payroll_run_item
  USING (
    tenant_company_matches(company_id) 
    AND tenant_branch_allowed(branch_id)
  );

-- ===== 7) Payroll Accumulation =====
ALTER TABLE payroll_accumulation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_payroll_accumulation ON payroll_accumulation;
CREATE POLICY tenant_isolation_payroll_accumulation ON payroll_accumulation
  USING (tenant_company_matches(company_id));

-- ===== 8) Worklog FT =====
ALTER TABLE worklog_ft ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_worklog_ft ON worklog_ft;
CREATE POLICY tenant_isolation_worklog_ft ON worklog_ft
  USING (
    tenant_company_matches(company_id) 
    AND tenant_branch_allowed(branch_id)
  );

-- ===== 9) Worklog PT =====
ALTER TABLE worklog_pt ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_worklog_pt ON worklog_pt;
CREATE POLICY tenant_isolation_worklog_pt ON worklog_pt
  USING (
    tenant_company_matches(company_id) 
    AND tenant_branch_allowed(branch_id)
  );

-- ===== 10) Payout PT =====
ALTER TABLE payout_pt ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_payout_pt ON payout_pt;
CREATE POLICY tenant_isolation_payout_pt ON payout_pt
  USING (
    tenant_company_matches(company_id) 
    AND tenant_branch_allowed(branch_id)
  );

-- ===== 11) Salary Advance =====
ALTER TABLE salary_advance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_salary_advance ON salary_advance;
CREATE POLICY tenant_isolation_salary_advance ON salary_advance
  USING (
    tenant_company_matches(company_id) 
    AND tenant_branch_allowed(branch_id)
  );

-- ===== 12) Debt Transaction =====
ALTER TABLE debt_txn ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_debt_txn ON debt_txn;
CREATE POLICY tenant_isolation_debt_txn ON debt_txn
  USING (
    tenant_company_matches(company_id) 
    AND tenant_branch_allowed(branch_id)
  );

-- ===== 13) Bonus Cycle =====
ALTER TABLE bonus_cycle ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_bonus_cycle ON bonus_cycle;
CREATE POLICY tenant_isolation_bonus_cycle ON bonus_cycle
  USING (
    tenant_company_matches(company_id) 
    AND tenant_branch_allowed(branch_id)
  );

-- ===== 13.1) Bonus Item =====
ALTER TABLE bonus_item ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_bonus_item ON bonus_item;
CREATE POLICY tenant_isolation_bonus_item ON bonus_item
  USING (
    tenant_company_matches(company_id) 
    AND tenant_branch_allowed(branch_id)
  );

-- ===== 14) Salary Raise Cycle (with branch filter) =====
ALTER TABLE salary_raise_cycle ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_salary_raise_cycle ON salary_raise_cycle;
CREATE POLICY tenant_isolation_salary_raise_cycle ON salary_raise_cycle
  USING (tenant_company_matches(company_id) AND tenant_branch_allowed(branch_id));

-- ===== 14.1) Salary Raise Item (with branch filter) =====
ALTER TABLE salary_raise_item ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_salary_raise_item ON salary_raise_item;
CREATE POLICY tenant_isolation_salary_raise_item ON salary_raise_item
  USING (tenant_company_matches(company_id) AND tenant_branch_allowed(branch_id));

-- ===== 14.2) Payout PT Item (if exists) =====
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payout_pt_item') THEN
    ALTER TABLE payout_pt_item ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_payout_pt_item ON payout_pt_item';
    EXECUTE 'CREATE POLICY tenant_isolation_payout_pt_item ON payout_pt_item
      USING (
        tenant_company_matches(company_id) 
        AND tenant_branch_allowed(branch_id)
      )';
  END IF;
END $$;

-- ===== 15) Payroll Org Profile (if exists) =====
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payroll_org_profile') THEN
    ALTER TABLE payroll_org_profile ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_payroll_org_profile ON payroll_org_profile';
    EXECUTE 'CREATE POLICY tenant_isolation_payroll_org_profile ON payroll_org_profile USING (tenant_company_matches(company_id))';
  END IF;
END $$;

-- ===== 15.1) Payroll Org Logo (if exists) =====
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payroll_org_logo') THEN
    ALTER TABLE payroll_org_logo ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_payroll_org_logo ON payroll_org_logo';
    EXECUTE 'CREATE POLICY tenant_isolation_payroll_org_logo ON payroll_org_logo USING (tenant_company_matches(company_id))';
  END IF;
END $$;

-- ===== 16) Users =====
-- NOTE: RLS on users table is DISABLED for now
-- Until API properly sets app.* session variables for all queries (including non-transactional),
-- we cannot enforce RLS on users. This will be re-enabled in a future migration.
-- 
-- The challenge: GetUser query runs without transaction, so session variables aren't set.
-- Solution needed: Either wrap all queries in transactions, or use connection-level settings.
--
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS tenant_isolation_users ON users;
-- CREATE POLICY tenant_isolation_users ON users
--   USING (...);

-- ===== Optional tables =====
DO $$
BEGIN
  -- Activity Log
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_log') THEN
    ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_activity_log ON activity_log';
    EXECUTE 'CREATE POLICY tenant_isolation_activity_log ON activity_log
      USING (
        company_id IS NULL OR (
          tenant_company_matches(company_id) 
          AND (branch_id IS NULL OR tenant_branch_allowed(branch_id))
        )
      )';
  END IF;
  
  -- Employee Document
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employee_document') THEN
    ALTER TABLE employee_document ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_employee_document ON employee_document';
    EXECUTE 'CREATE POLICY tenant_isolation_employee_document ON employee_document
      USING (tenant_company_matches(company_id))';
  END IF;
END $$;

-- ===== IMPORTANT: Bypass RLS for superuser and app user =====
-- The application should connect with a user that has BYPASSRLS or use SET LOCAL
-- to set the session variables before queries

-- Done: RLS policies created successfully. Remember to SET LOCAL app.* variables in transactions.
