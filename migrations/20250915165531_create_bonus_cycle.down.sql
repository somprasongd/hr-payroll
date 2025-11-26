-- ============================================================
-- Rollback – Bonus Cycle system
-- ============================================================

-- 1  Drop all triggers that were added
DROP TRIGGER IF EXISTS tg_bonus_cycle_set_updated   ON bonus_cycle;
DROP TRIGGER IF EXISTS tg_bonus_cycle_guard_update ON bonus_cycle;
DROP TRIGGER IF EXISTS tg_bonus_cycle_ai           ON bonus_cycle;
DROP TRIGGER IF EXISTS tg_bonus_item_set_updated   ON bonus_item;
DROP TRIGGER IF EXISTS tg_bonus_item_guard_edit_bi ON bonus_item;
DROP TRIGGER IF EXISTS tg_worklog_ft_sync_bonus     ON worklog_ft;
DROP TRIGGER IF EXISTS tg_bonus_sync_employee_pay   ON employees;

-- 2  Drop trigger functions defined in this script
DROP FUNCTION IF EXISTS bonus_item_guard_edit()         CASCADE;
DROP FUNCTION IF EXISTS bonus_item_recompute_snapshot(UUID, UUID)  CASCADE;
DROP FUNCTION IF EXISTS bonus_cycle_after_insert()     CASCADE;
DROP FUNCTION IF EXISTS worklog_ft_sync_bonus_item()   CASCADE;
DROP FUNCTION IF EXISTS bonus_sync_item_on_employee_pay() CASCADE;

-- 3  Drop the bonus_item table (CASCADE will drop indexes, FK, etc.)
DROP TABLE IF EXISTS bonus_item CASCADE;

-- 4  Drop the bonus_cycle table
DROP TABLE IF EXISTS bonus_cycle CASCADE;

-- 5  Drop the domain that was created
DROP DOMAIN IF EXISTS bonus_status CASCADE;
