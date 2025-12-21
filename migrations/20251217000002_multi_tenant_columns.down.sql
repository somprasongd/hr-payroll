-- =========================================
-- Rollback: Multi-Branch Support - Tenant Columns
-- =========================================

-- Note: This only removes the columns, not the data that was backfilled

-- IMPORTANT: Drop RLS policies first (they depend on these columns)
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
DROP POLICY IF EXISTS tenant_isolation_users ON users;
DROP POLICY IF EXISTS tenant_isolation_payroll_org_profile ON payroll_org_profile;
DROP POLICY IF EXISTS tenant_isolation_payroll_org_logo ON payroll_org_logo;
DROP POLICY IF EXISTS tenant_isolation_employee_document ON employee_document;

-- Disable RLS on all tables
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
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Drop tenant propagation triggers (item tables)
DROP TRIGGER IF EXISTS tg_payroll_run_item_set_tenant ON payroll_run_item;
DROP TRIGGER IF EXISTS tg_bonus_item_set_tenant ON bonus_item;
DROP TRIGGER IF EXISTS tg_salary_raise_item_set_tenant ON salary_raise_item;
DROP TRIGGER IF EXISTS tg_payout_pt_item_set_tenant ON payout_pt_item;

-- Drop tenant propagation triggers (employee-related tables)
DROP TRIGGER IF EXISTS tg_worklog_ft_set_tenant ON worklog_ft;
DROP TRIGGER IF EXISTS tg_worklog_pt_set_tenant ON worklog_pt;
DROP TRIGGER IF EXISTS tg_payout_pt_set_tenant ON payout_pt;
DROP TRIGGER IF EXISTS tg_salary_advance_set_tenant ON salary_advance;
DROP TRIGGER IF EXISTS tg_debt_txn_set_tenant ON debt_txn;
DROP TRIGGER IF EXISTS tg_payroll_accumulation_set_tenant ON payroll_accumulation;

-- Drop tenant propagation triggers (default tenant tables)
DROP TRIGGER IF EXISTS tg_payroll_run_set_tenant ON payroll_run;
DROP TRIGGER IF EXISTS tg_payroll_config_set_tenant ON payroll_config;
DROP TRIGGER IF EXISTS tg_bonus_cycle_set_tenant ON bonus_cycle;
DROP TRIGGER IF EXISTS tg_salary_raise_cycle_set_tenant ON salary_raise_cycle;
DROP TRIGGER IF EXISTS tg_department_set_tenant ON department;
DROP TRIGGER IF EXISTS tg_employee_position_set_tenant ON employee_position;
DROP TRIGGER IF EXISTS tg_employees_set_tenant ON employees;

-- Drop tenant propagation functions
DROP FUNCTION IF EXISTS payroll_run_item_set_tenant();
DROP FUNCTION IF EXISTS bonus_item_set_tenant();
DROP FUNCTION IF EXISTS salary_raise_item_set_tenant();
DROP FUNCTION IF EXISTS payout_pt_item_set_tenant();
DROP FUNCTION IF EXISTS set_tenant_from_employee();
DROP FUNCTION IF EXISTS set_default_tenant();


-- Drop helper functions used by RLS
DROP FUNCTION IF EXISTS tenant_branch_allowed(UUID);
DROP FUNCTION IF EXISTS tenant_company_matches(UUID);

-- Remove indexes (note: users.company_id was never added)
DROP INDEX IF EXISTS employees_company_idx;
DROP INDEX IF EXISTS employees_branch_idx;
DROP INDEX IF EXISTS employees_tenant_idx;
DROP INDEX IF EXISTS department_company_idx;
DROP INDEX IF EXISTS department_company_code_active_uk;
DROP INDEX IF EXISTS employee_position_company_idx;
DROP INDEX IF EXISTS employee_position_company_code_active_uk;
DROP INDEX IF EXISTS payroll_config_company_idx;
DROP INDEX IF EXISTS payroll_run_company_idx;
DROP INDEX IF EXISTS payroll_run_branch_idx;
DROP INDEX IF EXISTS payroll_run_branch_month_uk;
DROP INDEX IF EXISTS payroll_run_item_tenant_idx;
DROP INDEX IF EXISTS payroll_accumulation_company_idx;
DROP INDEX IF EXISTS worklog_ft_tenant_idx;
DROP INDEX IF EXISTS worklog_pt_tenant_idx;
DROP INDEX IF EXISTS payout_pt_tenant_idx;
DROP INDEX IF EXISTS salary_advance_tenant_idx;
DROP INDEX IF EXISTS debt_txn_tenant_idx;
DROP INDEX IF EXISTS bonus_cycle_tenant_idx;
DROP INDEX IF EXISTS salary_raise_cycle_tenant_idx;
DROP INDEX IF EXISTS org_profile_company_uk;
DROP INDEX IF EXISTS activity_logs_tenant_idx;
DROP INDEX IF EXISTS employee_document_company_idx;

-- Document type indexes
DROP INDEX IF EXISTS employee_document_type_company_idx;
DROP INDEX IF EXISTS employee_document_type_code_uk;

-- Restore original unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS department_code_active_uk ON department (lower(code)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS employee_position_code_active_uk ON employee_position (lower(code)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payroll_run_month_uk ON payroll_run (payroll_month_date) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS employee_document_type_code_active_uk ON employee_document_type (lower(code)) WHERE deleted_at IS NULL;

-- Remove columns (note: users.company_id was never added)
ALTER TABLE employees DROP COLUMN IF EXISTS company_id;
ALTER TABLE employees DROP COLUMN IF EXISTS branch_id;
ALTER TABLE department DROP COLUMN IF EXISTS company_id;
ALTER TABLE employee_position DROP COLUMN IF EXISTS company_id;
ALTER TABLE payroll_config DROP COLUMN IF EXISTS company_id;
ALTER TABLE payroll_run DROP COLUMN IF EXISTS company_id;
ALTER TABLE payroll_run DROP COLUMN IF EXISTS branch_id;
ALTER TABLE payroll_run_item DROP COLUMN IF EXISTS company_id;
ALTER TABLE payroll_run_item DROP COLUMN IF EXISTS branch_id;
ALTER TABLE payroll_accumulation DROP COLUMN IF EXISTS company_id;
ALTER TABLE worklog_ft DROP COLUMN IF EXISTS company_id;
ALTER TABLE worklog_ft DROP COLUMN IF EXISTS branch_id;
ALTER TABLE worklog_pt DROP COLUMN IF EXISTS company_id;
ALTER TABLE worklog_pt DROP COLUMN IF EXISTS branch_id;
ALTER TABLE payout_pt DROP COLUMN IF EXISTS company_id;
ALTER TABLE payout_pt DROP COLUMN IF EXISTS branch_id;
ALTER TABLE salary_advance DROP COLUMN IF EXISTS company_id;
ALTER TABLE salary_advance DROP COLUMN IF EXISTS branch_id;
ALTER TABLE debt_txn DROP COLUMN IF EXISTS company_id;
ALTER TABLE debt_txn DROP COLUMN IF EXISTS branch_id;
ALTER TABLE bonus_cycle DROP COLUMN IF EXISTS company_id;
ALTER TABLE bonus_cycle DROP COLUMN IF EXISTS branch_id;
ALTER TABLE bonus_item DROP COLUMN IF EXISTS company_id;
ALTER TABLE bonus_item DROP COLUMN IF EXISTS branch_id;
DROP INDEX IF EXISTS bonus_item_tenant_idx;

ALTER TABLE salary_raise_cycle DROP COLUMN IF EXISTS company_id;
ALTER TABLE salary_raise_cycle DROP COLUMN IF EXISTS branch_id;
ALTER TABLE salary_raise_item DROP COLUMN IF EXISTS company_id;
ALTER TABLE salary_raise_item DROP COLUMN IF EXISTS branch_id;
DROP INDEX IF EXISTS salary_raise_item_tenant_idx;

-- Document type columns
ALTER TABLE employee_document_type DROP COLUMN IF EXISTS is_system;
ALTER TABLE employee_document_type DROP COLUMN IF EXISTS company_id;

-- Drop payout_pt_item tenant columns if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payout_pt_item') THEN
    ALTER TABLE payout_pt_item DROP COLUMN IF EXISTS company_id;
    ALTER TABLE payout_pt_item DROP COLUMN IF EXISTS branch_id;
    DROP INDEX IF EXISTS payout_pt_item_tenant_idx;
  END IF;
END $$;

-- Optional tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payroll_org_profile') THEN
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_payroll_org_profile ON payroll_org_profile';
    ALTER TABLE payroll_org_profile DISABLE ROW LEVEL SECURITY;
    
    -- Restore original no_overlap constraint without company_id
    ALTER TABLE payroll_org_profile DROP CONSTRAINT IF EXISTS payroll_org_profile_no_overlap;
    ALTER TABLE payroll_org_profile 
      ADD CONSTRAINT payroll_org_profile_no_overlap
      EXCLUDE USING gist (
        effective_daterange WITH &&
      )
      WHERE (status = 'active')
      DEFERRABLE INITIALLY DEFERRED;
      
    DROP INDEX IF EXISTS payroll_org_profile_company_idx;
    ALTER TABLE payroll_org_profile DROP COLUMN IF EXISTS company_id;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payroll_org_logo') THEN
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_payroll_org_logo ON payroll_org_logo';
    ALTER TABLE payroll_org_logo DISABLE ROW LEVEL SECURITY;
    
    -- Restore original checksum constraint
    DROP INDEX IF EXISTS payroll_org_logo_company_checksum_uk;
    CREATE UNIQUE INDEX IF NOT EXISTS payroll_org_logo_checksum_uk 
      ON payroll_org_logo(checksum_md5);
      
    DROP INDEX IF EXISTS payroll_org_logo_company_idx;
    ALTER TABLE payroll_org_logo DROP COLUMN IF EXISTS company_id;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_logs') THEN
    ALTER TABLE activity_logs DROP COLUMN IF EXISTS company_id;
    ALTER TABLE activity_logs DROP COLUMN IF EXISTS branch_id;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employee_document') THEN
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_employee_document ON employee_document';
    ALTER TABLE employee_document DISABLE ROW LEVEL SECURITY;
    ALTER TABLE employee_document DROP COLUMN IF EXISTS company_id;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employee_photo') THEN
    DROP INDEX IF EXISTS employee_photo_company_checksum_uk;
    CREATE UNIQUE INDEX IF NOT EXISTS employee_photo_checksum_uk ON employee_photo(checksum_md5);
    DROP INDEX IF EXISTS employee_photo_company_idx;
    ALTER TABLE employee_photo DROP COLUMN IF EXISTS company_id;
  END IF;
END $$;
