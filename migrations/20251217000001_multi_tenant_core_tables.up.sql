-- =========================================
-- Multi-Branch Support - Core Tables & Seed
-- 
-- Consolidated from:
-- - 20251217215346_create_companies_branches
-- - 20251218061600_create_superadmin_user
-- - 20251219064200_add_branches_deleted_at
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
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Soft delete support
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  deleted_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Code unique per company
CREATE UNIQUE INDEX branches_company_code_uk ON branches (company_id, lower(code));

-- Only one default branch per company
CREATE UNIQUE INDEX branches_default_uk ON branches (company_id) 
  WHERE is_default = TRUE;

-- Index for efficient filtering of non-deleted branches
CREATE INDEX branches_deleted_at_idx ON branches (deleted_at) WHERE deleted_at IS NULL;

-- Auto update timestamp
CREATE TRIGGER tg_branches_set_updated
BEFORE UPDATE ON branches
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Comment explaining the soft delete logic
COMMENT ON COLUMN branches.deleted_at IS 'Soft delete timestamp. Branch can only be deleted when status is archived.';

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

-- ===== 5) Add 'superadmin' to the user_role domain =====
DO $$
BEGIN
  -- Only modify if superadmin is not already in the domain
  ALTER DOMAIN user_role DROP CONSTRAINT user_role_check;
  ALTER DOMAIN user_role ADD CONSTRAINT user_role_check CHECK (VALUE IN ('hr','admin','superadmin'));
EXCEPTION
  WHEN OTHERS THEN NULL; -- Ignore if already exists
END $$;

-- Update guard trigger to allow superadmin to create users too
CREATE OR REPLACE FUNCTION public.users_guard_create_policy() RETURNS trigger AS $$
DECLARE
    v_creator_role public.user_role;
BEGIN
    IF NEW.created_by IS NULL THEN
        RAISE EXCEPTION 'created_by is required to identify the creator.';
    END IF;

    SELECT user_role INTO v_creator_role 
    FROM public.users 
    WHERE id = NEW.created_by;

    -- Allow admin OR superadmin to create users
    IF v_creator_role NOT IN ('admin', 'superadmin') THEN
        RAISE EXCEPTION 'Access Denied: Only administrators or superadmin can create new users. (User ID % is %)', NEW.created_by, v_creator_role;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===== 6) Seed Default Company, Branch, and Superadmin User =====
DO $$
DECLARE 
  v_admin_id UUID;
  v_company_id UUID;
  v_branch_id UUID;
  v_superadmin_id UUID;
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
  
  -- Create superadmin user (if not exists)
  IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'superadmin' AND deleted_at IS NULL) THEN
    -- Password: 'changeme'
    INSERT INTO users (username, password_hash, user_role, created_by, updated_by)
    VALUES ('superadmin', '$argon2id$v=19$m=65536,t=3,p=4$vdCnms0qqpwQwsGkU9tONQ$/wvzZ56+cOqNU2AUQzQxmKAr0x+JrFCL7Qa1YeQxvpg', 'superadmin', v_admin_id, v_admin_id)
    RETURNING id INTO v_superadmin_id;
    
    -- Update to self-reference (superadmin created itself)
    UPDATE users SET created_by = v_superadmin_id, updated_by = v_superadmin_id
    WHERE id = v_superadmin_id;
    
    RAISE NOTICE 'Created superadmin user with id: % (self-referencing)', v_superadmin_id;
  ELSE
    RAISE NOTICE 'Superadmin user already exists.';
  END IF;
END $$;
