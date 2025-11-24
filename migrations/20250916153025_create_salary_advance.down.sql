-- ===========================================
-- Rollback – Salary Advance (advance_status domain, table, triggers, function)
-- ===========================================

-- 1 Drop the two triggers that were added to salary_advance
DROP TRIGGER IF EXISTS tg_salary_advance_set_updated   ON salary_advance;
DROP TRIGGER IF EXISTS tg_salary_advance_guard_update ON salary_advance;

-- 2  Drop the table (and all its indexes, constraints, FK references)
DROP TABLE IF EXISTS salary_advance CASCADE;

-- 3  Drop the domain that was created
DROP DOMAIN IF EXISTS advance_status CASCADE;
