-- Migration: Add 'timekeeper' role
-- This role can only access worklog pages (PT/FT) and view dashboard (restricted)

-- 1. Add 'timekeeper' to user_role domain
ALTER DOMAIN user_role DROP CONSTRAINT user_role_check;
ALTER DOMAIN user_role ADD CONSTRAINT user_role_check 
  CHECK (VALUE IN ('hr','admin','superadmin','timekeeper'));

-- 2. Update user_company_roles table constraint to allow timekeeper
ALTER TABLE user_company_roles DROP CONSTRAINT user_company_roles_role_check;
ALTER TABLE user_company_roles ADD CONSTRAINT user_company_roles_role_check 
  CHECK (role IN ('admin', 'hr', 'timekeeper'));
