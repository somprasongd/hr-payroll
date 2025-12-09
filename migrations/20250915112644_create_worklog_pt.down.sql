-- Rollback script for the Part‑time system

-- 1. Drop all trigger functions
DROP FUNCTION IF EXISTS employees_sync_payout_rate_after_update() CASCADE;
DROP FUNCTION IF EXISTS worklog_pt_no_edit_after_approved() CASCADE;
DROP FUNCTION IF EXISTS payout_pt_recalc_and_sync(UUID) CASCADE;
DROP FUNCTION IF EXISTS payout_pt_item_after_insert() CASCADE;
DROP FUNCTION IF EXISTS payout_pt_item_after_delete() CASCADE;
DROP FUNCTION IF EXISTS payout_pt_after_update() CASCADE;

-- 2. Drop all triggers
DROP TRIGGER IF EXISTS tg_employees_sync_payout_rate ON employees;
DROP TRIGGER IF EXISTS tg_worklog_pt_set_updated ON worklog_pt;
DROP TRIGGER IF EXISTS tg_worklog_pt_no_edit ON worklog_pt;
DROP TRIGGER IF EXISTS tg_payout_pt_set_updated ON payout_pt;
DROP TRIGGER IF EXISTS tg_payout_pt_item_ai ON payout_pt_item;
DROP TRIGGER IF EXISTS tg_payout_pt_item_ad ON payout_pt_item;
DROP TRIGGER IF EXISTS tg_payout_pt_au ON payout_pt;

-- 3. Drop indexes
DROP INDEX IF EXISTS worklog_pt_filter_idx;
DROP INDEX IF EXISTS worklog_pt_emp_date_idx;
DROP INDEX IF EXISTS payout_pt_filter_idx;
DROP INDEX IF EXISTS payout_pt_item_worklog_active_uk;

-- 4. Drop tables (CASCADE will remove all dependent objects)
DROP TABLE IF EXISTS payout_pt_item CASCADE;
DROP TABLE IF EXISTS payout_pt CASCADE;
DROP TABLE IF EXISTS worklog_pt CASCADE;

-- 5. Drop domains
DROP DOMAIN IF EXISTS worklog_pt_status CASCADE;
DROP DOMAIN IF EXISTS payout_pt_status CASCADE;
