-- Remove superadmin user
-- Superadmin works outside the tenant system, just delete user

DELETE FROM users WHERE username = 'superadmin' AND user_role = 'superadmin';

-- Revert user_role domain (remove superadmin)
DO $$
BEGIN
  ALTER DOMAIN user_role DROP CONSTRAINT user_role_check;
  ALTER DOMAIN user_role ADD CONSTRAINT user_role_check CHECK (VALUE IN ('hr','admin'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;
