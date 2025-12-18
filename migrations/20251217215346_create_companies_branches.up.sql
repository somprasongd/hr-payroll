-- =========================================
-- Multi-Branch Support - Phase 1
-- Create companies, branches, and user role tables
-- =========================================

-- ===== 1) Companies Table =====
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'suspended', 'archived')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Code unique constraint
CREATE UNIQUE INDEX companies_code_uk ON companies (lower(code));

-- Auto update timestamp
CREATE TRIGGER tg_companies_set_updated
BEFORE UPDATE ON companies
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===== 2) Branches Table =====
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'suspended', 'archived')),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Code unique per company
CREATE UNIQUE INDEX branches_company_code_uk ON branches (company_id, lower(code));

-- Only one default branch per company
CREATE UNIQUE INDEX branches_default_uk ON branches (company_id) 
  WHERE is_default = TRUE;

-- Auto update timestamp
CREATE TRIGGER tg_branches_set_updated
BEFORE UPDATE ON branches
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===== 3) User Company Roles =====
-- Maps users to companies with their role at company level
CREATE TABLE user_company_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'hr')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  PRIMARY KEY (user_id, company_id)
);

CREATE INDEX user_company_roles_company_idx ON user_company_roles (company_id);

-- ===== 4) User Branch Access =====
-- Maps HR users to specific branches they can access
CREATE TABLE user_branch_access (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  PRIMARY KEY (user_id, branch_id)
);

CREATE INDEX user_branch_access_branch_idx ON user_branch_access (branch_id);

-- ===== 5) Seed Default Company and Branch =====
DO $$
DECLARE 
  v_admin_id UUID;
  v_company_id UUID;
  v_branch_id UUID;
  v_user RECORD;
BEGIN
  -- Get admin user for created_by
  SELECT id INTO v_admin_id FROM users WHERE user_role = 'admin' AND deleted_at IS NULL LIMIT 1;
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin user not found. Please ensure admin user exists.';
  END IF;
  
  -- Create default company
  INSERT INTO companies (code, name, status, created_by, updated_by)
  VALUES ('DEFAULT', 'Default Company', 'active', v_admin_id, v_admin_id)
  RETURNING id INTO v_company_id;
  
  -- Create default branch (สำนักงานใหญ่)
  INSERT INTO branches (company_id, code, name, status, is_default, created_by, updated_by)
  VALUES (v_company_id, '00000', 'สำนักงานใหญ่', 'active', TRUE, v_admin_id, v_admin_id)
  RETURNING id INTO v_branch_id;
  
  -- Migrate ALL existing users to default company and branch
  FOR v_user IN 
    SELECT id, user_role FROM users WHERE deleted_at IS NULL
  LOOP
    -- Assign user to company with their role (admin/hr)
    INSERT INTO user_company_roles (user_id, company_id, role, created_by)
    VALUES (v_user.id, v_company_id, v_user.user_role, v_admin_id)
    ON CONFLICT DO NOTHING;
    
    -- Assign user to default branch
    INSERT INTO user_branch_access (user_id, branch_id, created_by)
    VALUES (v_user.id, v_branch_id, v_admin_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  RAISE NOTICE 'Created default company (%) and branch (%). Migrated all existing users.', v_company_id, v_branch_id;
END $$;
