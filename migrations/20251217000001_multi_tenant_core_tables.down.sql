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

-- Remove seed data first (handled by CASCADE)

-- Drop tables in reverse order
DROP TABLE IF EXISTS user_branch_access CASCADE;
DROP TABLE IF EXISTS user_company_roles CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
