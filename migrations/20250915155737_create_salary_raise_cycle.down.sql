-- ==============================
-- Rollback – Salary‑raise cycle system
-- ==============================

DROP TRIGGER IF EXISTS tg_salary_raise_cycle_set_updated    ON salary_raise_cycle;
DROP TRIGGER IF EXISTS tg_salary_raise_cycle_guard_update   ON salary_raise_cycle;
DROP TRIGGER IF EXISTS tg_salary_raise_cycle_ai             ON salary_raise_cycle;
DROP TRIGGER IF EXISTS tg_salary_raise_cycle_on_approve     ON salary_raise_cycle;
DROP TRIGGER IF EXISTS tg_salary_raise_item_set_updated     ON salary_raise_item;
DROP TRIGGER IF EXISTS tg_salary_raise_item_guard_edit_bi   ON salary_raise_item;
DROP TRIGGER IF EXISTS tg_salary_raise_item_validate_type   ON salary_raise_item;
DROP TRIGGER IF EXISTS tg_worklog_ft_sync_raise             ON worklog_ft;

-- 2  Drop the helper/guard functions created in this script
DROP FUNCTION IF EXISTS salary_raise_cycle_guard_update();
DROP FUNCTION IF EXISTS salary_raise_cycle_after_insert();
DROP FUNCTION IF EXISTS salary_raise_cycle_on_approve();
DROP FUNCTION IF EXISTS salary_raise_item_guard_edit();
DROP FUNCTION IF EXISTS salary_raise_item_validate_employee_type();
DROP FUNCTION IF EXISTS salary_raise_item_recompute_snapshot(UUID, UUID);
DROP FUNCTION IF EXISTS worklog_ft_sync_salary_raise_item();

-- 3  Drop the tables (indexes are removed automatically with CASCADE)
DROP TABLE IF EXISTS salary_raise_item   CASCADE;
DROP TABLE IF EXISTS salary_raise_cycle  CASCADE;

-- 4  Drop the domain that was created
DROP DOMAIN IF EXISTS salary_raise_status  CASCADE;
