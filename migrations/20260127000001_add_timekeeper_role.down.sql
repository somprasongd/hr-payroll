-- Rollback: Remove 'timekeeper' role
-- WARNING: This will fail if any users have the 'timekeeper' role assigned

-- 1. Revert user_company_roles constraint
ALTER TABLE user_company_roles DROP CONSTRAINT user_company_roles_role_check;
ALTER TABLE user_company_roles ADD CONSTRAINT user_company_roles_role_check 
  CHECK (role IN ('admin', 'hr'));

-- 2. Revert user_role domain (remove timekeeper)
ALTER DOMAIN user_role DROP CONSTRAINT user_role_check;
ALTER DOMAIN user_role ADD CONSTRAINT user_role_check 
  CHECK (VALUE IN ('hr','admin','superadmin'));
