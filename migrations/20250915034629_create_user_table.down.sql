-- ------------------------------------------------------------
-- Rollback – Users domain, table, indexes, triggers, function
-- ------------------------------------------------------------

-- 1. Drop view and auxiliary table/indexes
DROP VIEW IF EXISTS public.v_users_with_last_login CASCADE;
DROP INDEX IF EXISTS public.user_access_logs_lookup_idx;
DROP TABLE IF EXISTS public.user_access_logs CASCADE;

-- 2. Drop guard trigger/function
DROP TRIGGER IF EXISTS tg_users_guard_create ON public.users;
DROP FUNCTION IF EXISTS public.users_guard_create_policy() CASCADE;

-- 3. Drop the trigger that keeps updated_at in sync
DROP TRIGGER IF EXISTS trg_users_set_updated_at ON users;

-- 4. Drop the helper function that the trigger uses
DROP FUNCTION IF EXISTS set_updated_at() CASCADE;

-- 5. Drop the unique/utility indexes that were added
DROP INDEX IF EXISTS users_username_active_ux;
DROP INDEX IF EXISTS users_created_by_idx;
DROP INDEX IF EXISTS users_updated_by_idx;
DROP INDEX IF EXISTS users_deleted_by_idx;
DROP INDEX IF EXISTS users_active_created_at_idx;

-- 6. Drop the main table (this will also remove any remaining dependent constraints)
DROP TABLE IF EXISTS users CASCADE;

-- 7. Drop the custom domain used for user_role
DROP DOMAIN IF EXISTS user_role;
