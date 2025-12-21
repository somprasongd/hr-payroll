-- =========================================
-- Rollback: Multi-Branch Support - Core Tables & Seed
-- =========================================

-- Remove superadmin user
DELETE FROM users WHERE username = 'superadmin' AND user_role = 'superadmin';

-- Revert user_role domain (remove superadmin)
DO $$
BEGIN
  ALTER DOMAIN user_role DROP CONSTRAINT user_role_check;
  ALTER DOMAIN user_role ADD CONSTRAINT user_role_check CHECK (VALUE IN ('hr','admin'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Revert payroll config guard to admin-only
CREATE OR REPLACE FUNCTION payroll_config_guard_create_policy() RETURNS trigger AS $$
DECLARE
    v_creator_role user_role;
BEGIN
    IF NEW.created_by IS NULL THEN
        RAISE EXCEPTION 'created_by is required to identify the creator.';
    END IF;

    SELECT user_role INTO v_creator_role
    FROM users
    WHERE id = NEW.created_by;

    IF v_creator_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Access Denied: Only administrators can create new payroll config. (User ID % is %)', NEW.created_by, v_creator_role;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remove seed data first (handled by CASCADE)

-- Drop tables in reverse order
DROP TABLE IF EXISTS user_branch_access CASCADE;
DROP TABLE IF EXISTS user_company_roles CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
