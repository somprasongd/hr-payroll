-- =========================================
-- Multi-Branch Support - Tenant Columns & Backfill
-- 
-- Consolidated from:
-- - 20251217215347_add_tenant_columns
-- - 20251219120400_add_document_type_tenant
-- =========================================

-- IMPORTANT: Disable all triggers during migration to avoid restrictions
SET session_replication_role = replica;

-- Get default company and branch IDs for backfill
DO $$
DECLARE 
  v_company_id UUID;
  v_branch_id UUID;
BEGIN
  -- Get default company
  SELECT id INTO v_company_id FROM companies WHERE code = 'DEFAULT' LIMIT 1;
  
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Default company not found. Please run previous migration first.';
  END IF;
  
  -- Get default branch
  SELECT id INTO v_branch_id FROM branches WHERE company_id = v_company_id AND is_default = TRUE LIMIT 1;
  
  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'Default branch not found.';
  END IF;
  
  -- Store in temp table for use in subsequent statements
  CREATE TEMP TABLE IF NOT EXISTS _tenant_defaults (company_id UUID, branch_id UUID);
  DELETE FROM _tenant_defaults;
  INSERT INTO _tenant_defaults VALUES (v_company_id, v_branch_id);
END $$;

-- ===== NOTE: Users table does NOT need company_id =====
-- Multi-company access is handled by user_company_roles table
-- This allows a single user to be in multiple companies

-- ===== 1) Employees table =====
ALTER TABLE employees ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

UPDATE employees SET 
  company_id = (SELECT company_id FROM _tenant_defaults LIMIT 1),
  branch_id = (SELECT branch_id FROM _tenant_defaults LIMIT 1)
WHERE company_id IS NULL OR branch_id IS NULL;

ALTER TABLE employees ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE employees ALTER COLUMN branch_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS employees_company_idx ON employees (company_id);
CREATE INDEX IF NOT EXISTS employees_branch_idx ON employees (branch_id);
CREATE INDEX IF NOT EXISTS employees_tenant_idx ON employees (company_id, branch_id);

-- Update employee_number uniqueness to be scoped by company
DROP INDEX IF EXISTS employees_empno_active_uk;
CREATE UNIQUE INDEX IF NOT EXISTS employees_company_empno_active_uk
  ON employees (company_id, lower(employee_number))
  WHERE employment_end_date IS NULL AND deleted_at IS NULL;

-- ===== 3) Department table =====
ALTER TABLE department ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

UPDATE department SET company_id = (SELECT company_id FROM _tenant_defaults LIMIT 1) 
WHERE company_id IS NULL;

ALTER TABLE department ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS department_company_idx ON department (company_id);

-- Update unique constraint to include company_id
DROP INDEX IF EXISTS department_code_active_uk;
CREATE UNIQUE INDEX IF NOT EXISTS department_company_code_active_uk ON department (company_id, lower(code)) WHERE deleted_at IS NULL;

-- ===== 4) Employee Position table =====
ALTER TABLE employee_position ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

UPDATE employee_position SET company_id = (SELECT company_id FROM _tenant_defaults LIMIT 1) 
WHERE company_id IS NULL;

ALTER TABLE employee_position ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS employee_position_company_idx ON employee_position (company_id);

-- Update unique constraint
DROP INDEX IF EXISTS employee_position_code_active_uk;
CREATE UNIQUE INDEX IF NOT EXISTS employee_position_company_code_active_uk ON employee_position (company_id, lower(code)) WHERE deleted_at IS NULL;

-- ===== 5) Payroll Config table =====
ALTER TABLE payroll_config ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

UPDATE payroll_config SET company_id = (SELECT company_id FROM _tenant_defaults LIMIT 1) 
WHERE company_id IS NULL;

ALTER TABLE payroll_config ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS payroll_config_company_idx ON payroll_config (company_id);

-- ===== 6) Payroll Run table =====
ALTER TABLE payroll_run ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE payroll_run ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- Temporarily disable trigger that blocks modifications on approved payroll_run
ALTER TABLE payroll_run DISABLE TRIGGER ALL;

UPDATE payroll_run SET 
  company_id = (SELECT company_id FROM _tenant_defaults LIMIT 1),
  branch_id = (SELECT branch_id FROM _tenant_defaults LIMIT 1)
WHERE company_id IS NULL OR branch_id IS NULL;

-- Re-enable triggers
ALTER TABLE payroll_run ENABLE TRIGGER ALL;

ALTER TABLE payroll_run ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE payroll_run ALTER COLUMN branch_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS payroll_run_company_idx ON payroll_run (company_id);
CREATE INDEX IF NOT EXISTS payroll_run_branch_idx ON payroll_run (branch_id);

-- Update unique constraint: month unique per branch
DROP INDEX IF EXISTS payroll_run_month_uk;
CREATE UNIQUE INDEX IF NOT EXISTS payroll_run_branch_month_uk ON payroll_run (branch_id, payroll_month_date) WHERE deleted_at IS NULL;

-- ===== 7) Payroll Run Item table =====
ALTER TABLE payroll_run_item ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE payroll_run_item ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- Temporarily disable trigger that blocks modifications
ALTER TABLE payroll_run_item DISABLE TRIGGER ALL;

UPDATE payroll_run_item pri SET 
  company_id = pr.company_id,
  branch_id = pr.branch_id
FROM payroll_run pr 
WHERE pri.run_id = pr.id AND (pri.company_id IS NULL OR pri.branch_id IS NULL);

-- Re-enable triggers
ALTER TABLE payroll_run_item ENABLE TRIGGER ALL;

ALTER TABLE payroll_run_item ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE payroll_run_item ALTER COLUMN branch_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS payroll_run_item_tenant_idx ON payroll_run_item (company_id, branch_id);

-- ===== 8) Payroll Accumulation table =====
ALTER TABLE payroll_accumulation ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

UPDATE payroll_accumulation pa SET company_id = e.company_id
FROM employees e WHERE pa.employee_id = e.id AND pa.company_id IS NULL;

-- For any remaining, use default
UPDATE payroll_accumulation SET company_id = (SELECT company_id FROM _tenant_defaults LIMIT 1) 
WHERE company_id IS NULL;

ALTER TABLE payroll_accumulation ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS payroll_accumulation_company_idx ON payroll_accumulation (company_id);

-- ===== 9) Worklog FT table =====
ALTER TABLE worklog_ft ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE worklog_ft ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

UPDATE worklog_ft wf SET 
  company_id = e.company_id,
  branch_id = e.branch_id
FROM employees e WHERE wf.employee_id = e.id AND (wf.company_id IS NULL OR wf.branch_id IS NULL);

-- For any remaining
UPDATE worklog_ft SET 
  company_id = (SELECT company_id FROM _tenant_defaults LIMIT 1),
  branch_id = (SELECT branch_id FROM _tenant_defaults LIMIT 1)
WHERE company_id IS NULL OR branch_id IS NULL;

ALTER TABLE worklog_ft ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE worklog_ft ALTER COLUMN branch_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS worklog_ft_tenant_idx ON worklog_ft (company_id, branch_id);

-- ===== 10) Worklog PT table =====
ALTER TABLE worklog_pt ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE worklog_pt ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

UPDATE worklog_pt wp SET 
  company_id = e.company_id,
  branch_id = e.branch_id
FROM employees e WHERE wp.employee_id = e.id AND (wp.company_id IS NULL OR wp.branch_id IS NULL);

UPDATE worklog_pt SET 
  company_id = (SELECT company_id FROM _tenant_defaults LIMIT 1),
  branch_id = (SELECT branch_id FROM _tenant_defaults LIMIT 1)
WHERE company_id IS NULL OR branch_id IS NULL;

ALTER TABLE worklog_pt ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE worklog_pt ALTER COLUMN branch_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS worklog_pt_tenant_idx ON worklog_pt (company_id, branch_id);

-- ===== 11) Payout PT table =====
ALTER TABLE payout_pt ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE payout_pt ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

UPDATE payout_pt pp SET 
  company_id = e.company_id,
  branch_id = e.branch_id
FROM employees e WHERE pp.employee_id = e.id AND (pp.company_id IS NULL OR pp.branch_id IS NULL);

UPDATE payout_pt SET 
  company_id = (SELECT company_id FROM _tenant_defaults LIMIT 1),
  branch_id = (SELECT branch_id FROM _tenant_defaults LIMIT 1)
WHERE company_id IS NULL OR branch_id IS NULL;

ALTER TABLE payout_pt ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE payout_pt ALTER COLUMN branch_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS payout_pt_tenant_idx ON payout_pt (company_id, branch_id);

-- ===== 12) Salary Advance table =====
ALTER TABLE salary_advance ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE salary_advance ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

UPDATE salary_advance sa SET 
  company_id = e.company_id,
  branch_id = e.branch_id
FROM employees e WHERE sa.employee_id = e.id AND (sa.company_id IS NULL OR sa.branch_id IS NULL);

UPDATE salary_advance SET 
  company_id = (SELECT company_id FROM _tenant_defaults LIMIT 1),
  branch_id = (SELECT branch_id FROM _tenant_defaults LIMIT 1)
WHERE company_id IS NULL OR branch_id IS NULL;

ALTER TABLE salary_advance ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE salary_advance ALTER COLUMN branch_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS salary_advance_tenant_idx ON salary_advance (company_id, branch_id);

-- ===== 13) Debt Transaction table =====
ALTER TABLE debt_txn ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE debt_txn ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

UPDATE debt_txn dt SET 
  company_id = e.company_id,
  branch_id = e.branch_id
FROM employees e WHERE dt.employee_id = e.id AND (dt.company_id IS NULL OR dt.branch_id IS NULL);

UPDATE debt_txn SET 
  company_id = (SELECT company_id FROM _tenant_defaults LIMIT 1),
  branch_id = (SELECT branch_id FROM _tenant_defaults LIMIT 1)
WHERE company_id IS NULL OR branch_id IS NULL;

ALTER TABLE debt_txn ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE debt_txn ALTER COLUMN branch_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS debt_txn_tenant_idx ON debt_txn (company_id, branch_id);

-- ===== 14) Bonus Cycle table =====
ALTER TABLE bonus_cycle ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE bonus_cycle ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

UPDATE bonus_cycle SET 
  company_id = (SELECT company_id FROM _tenant_defaults LIMIT 1),
  branch_id = (SELECT branch_id FROM _tenant_defaults LIMIT 1)
WHERE company_id IS NULL OR branch_id IS NULL;

ALTER TABLE bonus_cycle ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE bonus_cycle ALTER COLUMN branch_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS bonus_cycle_tenant_idx ON bonus_cycle (company_id, branch_id);

-- ===== 14.1) Bonus Item table =====
ALTER TABLE bonus_item ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE bonus_item ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- Backfill from bonus_cycle (parent)
UPDATE bonus_item bi SET 
  company_id = bc.company_id,
  branch_id = bc.branch_id
FROM bonus_cycle bc WHERE bi.cycle_id = bc.id AND (bi.company_id IS NULL OR bi.branch_id IS NULL);

-- Fallback to defaults if still null
UPDATE bonus_item SET 
  company_id = (SELECT company_id FROM _tenant_defaults LIMIT 1),
  branch_id = (SELECT branch_id FROM _tenant_defaults LIMIT 1)
WHERE company_id IS NULL OR branch_id IS NULL;

ALTER TABLE bonus_item ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE bonus_item ALTER COLUMN branch_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS bonus_item_tenant_idx ON bonus_item (company_id, branch_id);

-- ===== 15) Salary Raise Cycle table =====
ALTER TABLE salary_raise_cycle ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE salary_raise_cycle ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

UPDATE salary_raise_cycle SET 
  company_id = (SELECT company_id FROM _tenant_defaults LIMIT 1),
  branch_id = (SELECT branch_id FROM _tenant_defaults LIMIT 1)
WHERE company_id IS NULL OR branch_id IS NULL;

ALTER TABLE salary_raise_cycle ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE salary_raise_cycle ALTER COLUMN branch_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS salary_raise_cycle_tenant_idx ON salary_raise_cycle (company_id, branch_id);

-- ===== 15.1) Salary Raise Item table =====
ALTER TABLE salary_raise_item ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE salary_raise_item ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- Backfill from salary_raise_cycle (parent)
UPDATE salary_raise_item sri SET 
  company_id = src.company_id,
  branch_id = src.branch_id
FROM salary_raise_cycle src WHERE sri.cycle_id = src.id AND (sri.company_id IS NULL OR sri.branch_id IS NULL);

-- Fallback to defaults if still null
UPDATE salary_raise_item SET 
  company_id = (SELECT company_id FROM _tenant_defaults LIMIT 1),
  branch_id = (SELECT branch_id FROM _tenant_defaults LIMIT 1)
WHERE company_id IS NULL OR branch_id IS NULL;

ALTER TABLE salary_raise_item ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE salary_raise_item ALTER COLUMN branch_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS salary_raise_item_tenant_idx ON salary_raise_item (company_id, branch_id);

-- ===== 15.2) Payout PT Item table =====
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payout_pt_item') THEN
    ALTER TABLE payout_pt_item ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
    ALTER TABLE payout_pt_item ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
    
    -- Backfill from payout_pt (parent)
    UPDATE payout_pt_item ppi SET 
      company_id = pp.company_id,
      branch_id = pp.branch_id
    FROM payout_pt pp WHERE ppi.payout_id = pp.id AND (ppi.company_id IS NULL OR ppi.branch_id IS NULL);
    
    -- Fallback to defaults if still null
    UPDATE payout_pt_item SET 
      company_id = (SELECT company_id FROM _tenant_defaults LIMIT 1),
      branch_id = (SELECT branch_id FROM _tenant_defaults LIMIT 1)
    WHERE company_id IS NULL OR branch_id IS NULL;
    
    ALTER TABLE payout_pt_item ALTER COLUMN company_id SET NOT NULL;
    ALTER TABLE payout_pt_item ALTER COLUMN branch_id SET NOT NULL;
    EXECUTE 'CREATE INDEX IF NOT EXISTS payout_pt_item_tenant_idx ON payout_pt_item (company_id, branch_id)';
  END IF;
END $$;

-- ===== 16) Payroll Org Profile table (if exists) =====
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payroll_org_profile') THEN
    ALTER TABLE payroll_org_profile ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
    
    UPDATE payroll_org_profile SET company_id = (SELECT company_id FROM _tenant_defaults LIMIT 1) 
    WHERE company_id IS NULL;
    
    ALTER TABLE payroll_org_profile ALTER COLUMN company_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS payroll_org_profile_company_idx ON payroll_org_profile (company_id);
    
    -- Need to update the no_overlap constraint to include company_id
    -- Drop existing constraint and recreate with company_id
    ALTER TABLE payroll_org_profile DROP CONSTRAINT IF EXISTS payroll_org_profile_no_overlap;
    ALTER TABLE payroll_org_profile 
      ADD CONSTRAINT payroll_org_profile_no_overlap
      EXCLUDE USING gist (
        company_id WITH =,
        effective_daterange WITH &&
      )
      WHERE (status = 'active')
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

-- ===== 17) Payroll Org Logo table (if exists) =====
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payroll_org_logo') THEN
    ALTER TABLE payroll_org_logo ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
    
    UPDATE payroll_org_logo SET company_id = (SELECT company_id FROM _tenant_defaults LIMIT 1) 
    WHERE company_id IS NULL;
    
    ALTER TABLE payroll_org_logo ALTER COLUMN company_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS payroll_org_logo_company_idx ON payroll_org_logo (company_id);
    
    -- Update checksum unique constraint to be per-company
    DROP INDEX IF EXISTS payroll_org_logo_checksum_uk;
    CREATE UNIQUE INDEX IF NOT EXISTS payroll_org_logo_company_checksum_uk 
      ON payroll_org_logo(company_id, checksum_md5);
  END IF;
END $$;

-- ===== 18) Activity Log table (if exists) =====
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_logs') THEN
    ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
    ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
    
    UPDATE activity_logs SET 
      company_id = (SELECT company_id FROM _tenant_defaults LIMIT 1),
      branch_id = (SELECT branch_id FROM _tenant_defaults LIMIT 1)
    WHERE company_id IS NULL OR branch_id IS NULL;
    
    -- Activity log might have nulls for system-level activities, so don't enforce NOT NULL
    CREATE INDEX IF NOT EXISTS activity_logs_tenant_idx ON activity_logs (company_id, branch_id);
  END IF;
END $$;

-- ===== 19) Employee Document table (if exists) =====
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employee_document') THEN
    ALTER TABLE employee_document ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
    
    UPDATE employee_document ed SET company_id = e.company_id
    FROM employees e WHERE ed.employee_id = e.id AND ed.company_id IS NULL;
    
    UPDATE employee_document SET company_id = (SELECT company_id FROM _tenant_defaults LIMIT 1) 
    WHERE company_id IS NULL;
    
    ALTER TABLE employee_document ALTER COLUMN company_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS employee_document_company_idx ON employee_document (company_id);
  END IF;
END $$;

-- ===== 20) Employee Photo table (if exists) =====
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employee_photo') THEN
    ALTER TABLE employee_photo ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
    
    -- Copy company_id from employees who have this photo
    UPDATE employee_photo ep SET company_id = e.company_id
    FROM employees e WHERE e.photo_id = ep.id AND ep.company_id IS NULL;
    
    -- Fallback to default for orphan photos
    UPDATE employee_photo SET company_id = (SELECT company_id FROM _tenant_defaults LIMIT 1) 
    WHERE company_id IS NULL;
    
    ALTER TABLE employee_photo ALTER COLUMN company_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS employee_photo_company_idx ON employee_photo (company_id);
    
    -- Update checksum unique constraint to be per-company
    DROP INDEX IF EXISTS employee_photo_checksum_uk;
    CREATE UNIQUE INDEX IF NOT EXISTS employee_photo_company_checksum_uk 
      ON employee_photo(company_id, checksum_md5);
  END IF;
END $$;

-- ===== 21) Employee Document Type - Hybrid Support =====
-- System types (is_system=true, company_id=null): managed by superadmin, visible to all
-- Custom types (is_system=false, company_id=uuid): managed by company admin, visible to that company only

ALTER TABLE employee_document_type 
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark existing document types as system types (they were created before multi-tenancy)
UPDATE employee_document_type 
SET is_system = TRUE 
WHERE company_id IS NULL;

-- Drop old unique index (code only)
DROP INDEX IF EXISTS employee_document_type_code_active_uk;

-- Create new unique index: code must be unique per company (or globally for system types)
-- Using COALESCE to treat NULL company_id as a fixed UUID for system types
CREATE UNIQUE INDEX IF NOT EXISTS employee_document_type_code_uk 
  ON employee_document_type (
    lower(code), 
    COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE deleted_at IS NULL;

-- Add index for efficient tenant filtering
CREATE INDEX IF NOT EXISTS employee_document_type_company_idx 
  ON employee_document_type (company_id) 
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN employee_document_type.company_id IS 'NULL for system types, company UUID for custom types';
COMMENT ON COLUMN employee_document_type.is_system IS 'TRUE = system type (superadmin manages), FALSE = custom type (company admin manages)';

-- =========================================
-- TRIGGERS: Auto-populate tenant columns on INSERT
-- =========================================

-- 1) payroll_run_item: Copy from payroll_run (parent)
CREATE OR REPLACE FUNCTION payroll_run_item_set_tenant() RETURNS trigger AS $$
BEGIN
  IF NEW.company_id IS NULL OR NEW.branch_id IS NULL THEN
    SELECT company_id, branch_id INTO NEW.company_id, NEW.branch_id
    FROM payroll_run WHERE id = NEW.run_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_payroll_run_item_set_tenant ON payroll_run_item;
CREATE TRIGGER tg_payroll_run_item_set_tenant
BEFORE INSERT ON payroll_run_item
FOR EACH ROW
EXECUTE FUNCTION payroll_run_item_set_tenant();

-- 2) bonus_item: Copy from bonus_cycle (parent)
CREATE OR REPLACE FUNCTION bonus_item_set_tenant() RETURNS trigger AS $$
BEGIN
  IF NEW.company_id IS NULL OR NEW.branch_id IS NULL THEN
    SELECT company_id, branch_id INTO NEW.company_id, NEW.branch_id
    FROM bonus_cycle WHERE id = NEW.cycle_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_bonus_item_set_tenant ON bonus_item;
CREATE TRIGGER tg_bonus_item_set_tenant
BEFORE INSERT ON bonus_item
FOR EACH ROW
EXECUTE FUNCTION bonus_item_set_tenant();

-- 3) salary_raise_item: Copy from salary_raise_cycle (parent)
CREATE OR REPLACE FUNCTION salary_raise_item_set_tenant() RETURNS trigger AS $$
BEGIN
  IF NEW.company_id IS NULL OR NEW.branch_id IS NULL THEN
    SELECT company_id, branch_id INTO NEW.company_id, NEW.branch_id
    FROM salary_raise_cycle WHERE id = NEW.cycle_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_salary_raise_item_set_tenant ON salary_raise_item;
CREATE TRIGGER tg_salary_raise_item_set_tenant
BEFORE INSERT ON salary_raise_item
FOR EACH ROW
EXECUTE FUNCTION salary_raise_item_set_tenant();

-- 4) payout_pt_item: Copy from payout_pt (parent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payout_pt_item') THEN
    EXECUTE '
      CREATE OR REPLACE FUNCTION payout_pt_item_set_tenant() RETURNS trigger AS $fn$
      BEGIN
        IF NEW.company_id IS NULL OR NEW.branch_id IS NULL THEN
          SELECT company_id, branch_id INTO NEW.company_id, NEW.branch_id
          FROM payout_pt WHERE id = NEW.payout_id;
        END IF;
        RETURN NEW;
      END;
      $fn$ LANGUAGE plpgsql;
      
      DROP TRIGGER IF EXISTS tg_payout_pt_item_set_tenant ON payout_pt_item;
      CREATE TRIGGER tg_payout_pt_item_set_tenant
      BEFORE INSERT ON payout_pt_item
      FOR EACH ROW
      EXECUTE FUNCTION payout_pt_item_set_tenant();
    ';
  END IF;
END $$;

-- =========================================
-- TRIGGERS: Auto-populate tenant columns from employees table
-- =========================================

-- Generic function to copy tenant from employees table (for tables with employee_id)
CREATE OR REPLACE FUNCTION set_tenant_from_employee() RETURNS trigger AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO NEW.company_id
    FROM employees WHERE id = NEW.employee_id;
  END IF;

  IF TG_TABLE_NAME IN ('worklog_ft', 'worklog_pt', 'payout_pt', 'salary_advance', 'debt_txn') THEN
    IF NEW.branch_id IS NULL THEN
      SELECT branch_id INTO NEW.branch_id
      FROM employees WHERE id = NEW.employee_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to employee-related tables
DROP TRIGGER IF EXISTS tg_worklog_ft_set_tenant ON worklog_ft;
CREATE TRIGGER tg_worklog_ft_set_tenant
BEFORE INSERT ON worklog_ft FOR EACH ROW
EXECUTE FUNCTION set_tenant_from_employee();

DROP TRIGGER IF EXISTS tg_worklog_pt_set_tenant ON worklog_pt;
CREATE TRIGGER tg_worklog_pt_set_tenant
BEFORE INSERT ON worklog_pt FOR EACH ROW
EXECUTE FUNCTION set_tenant_from_employee();

DROP TRIGGER IF EXISTS tg_payout_pt_set_tenant ON payout_pt;
CREATE TRIGGER tg_payout_pt_set_tenant
BEFORE INSERT ON payout_pt FOR EACH ROW
EXECUTE FUNCTION set_tenant_from_employee();

DROP TRIGGER IF EXISTS tg_salary_advance_set_tenant ON salary_advance;
CREATE TRIGGER tg_salary_advance_set_tenant
BEFORE INSERT ON salary_advance FOR EACH ROW
EXECUTE FUNCTION set_tenant_from_employee();

DROP TRIGGER IF EXISTS tg_debt_txn_set_tenant ON debt_txn;
CREATE TRIGGER tg_debt_txn_set_tenant
BEFORE INSERT ON debt_txn FOR EACH ROW
EXECUTE FUNCTION set_tenant_from_employee();

DROP TRIGGER IF EXISTS tg_payroll_accumulation_set_tenant ON payroll_accumulation;
CREATE TRIGGER tg_payroll_accumulation_set_tenant
BEFORE INSERT ON payroll_accumulation FOR EACH ROW
EXECUTE FUNCTION set_tenant_from_employee();

-- =========================================
-- NOTE: set_default_tenant() function and triggers are NOT created.
-- API now explicitly passes company_id and branch_id for all INSERT operations.
-- This ensures data isolation in multi-tenant environment.
-- If company_id/branch_id is not provided, the NOT NULL constraint will catch it.
-- =========================================

-- Cleanup temp table
DROP TABLE IF EXISTS _tenant_defaults;

-- Re-enable all triggers
SET session_replication_role = origin;

-- Done: Tenant columns added to all tables successfully
