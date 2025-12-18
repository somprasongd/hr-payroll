-- Create superadmin user for internal admin portal
-- Superadmin works outside the tenant system, no company needed

-- First, add 'superadmin' to the user_role domain
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

-- Create superadmin user (temporarily disable trigger for self-creation)
DO $$
DECLARE 
  v_superadmin_id UUID;
  v_admin_id UUID;
BEGIN
  -- Check if superadmin already exists
  IF EXISTS (SELECT 1 FROM users WHERE username = 'superadmin' AND deleted_at IS NULL) THEN
    RAISE NOTICE 'Superadmin user already exists.';
    RETURN;
  END IF;
  
  -- Get any admin user id for initial creation
  SELECT id INTO v_admin_id FROM users WHERE user_role = 'admin' AND deleted_at IS NULL LIMIT 1;
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No admin user found. Cannot create superadmin.';
  END IF;
  
  -- Create superadmin user using admin (will update to self-reference after)
  -- Password: 'changeme'
  INSERT INTO users (username, password_hash, user_role, created_by, updated_by)
  VALUES ('superadmin', '$argon2id$v=19$m=65536,t=3,p=4$vdCnms0qqpwQwsGkU9tONQ$/wvzZ56+cOqNU2AUQzQxmKAr0x+JrFCL7Qa1YeQxvpg', 'superadmin', v_admin_id, v_admin_id)
  RETURNING id INTO v_superadmin_id;
  
  -- Update to self-reference (superadmin created itself)
  UPDATE users SET created_by = v_superadmin_id, updated_by = v_superadmin_id
  WHERE id = v_superadmin_id;
  
  RAISE NOTICE 'Created superadmin user with id: % (self-referencing)', v_superadmin_id;
END $$;
