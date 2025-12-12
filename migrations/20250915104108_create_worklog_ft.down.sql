-- Rollback script for the Full‑time worklog

-- 1. Drop all trigger functions
DROP FUNCTION IF EXISTS worklog_ft_guard_edit_when_not_pending() CASCADE;

-- 2. Drop all triggers
DROP TRIGGER IF EXISTS trg_worklog_ft_set_updated ON worklog_ft;
DROP TRIGGER IF EXISTS tg_worklog_ft_guard_edit ON worklog_ft;

-- 3. Drop indexes
DROP INDEX IF EXISTS worklog_ft_active_dts_idx;
DROP INDEX IF EXISTS worklog_ft_active_emp_date_idx;
DROP INDEX IF EXISTS worklog_ft_emp_date_type_uk;

-- 4. Drop the table
DROP TABLE IF EXISTS worklog_ft CASCADE;

-- 5. Drop the domains
DROP DOMAIN IF EXISTS work_entry_type CASCADE;
DROP DOMAIN IF EXISTS worklog_ft_status CASCADE;
