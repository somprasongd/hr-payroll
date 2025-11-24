-- ------------------------------------------------------------
-- Rollback – payroll_accumulation table/domain/index/trigger
-- ------------------------------------------------------------

-- Remove trigger that maintains updated timestamp
DROP TRIGGER IF EXISTS tg_payroll_accum_set_updated ON payroll_accumulation;

-- Remove supporting unique index before dropping the table
DROP INDEX IF EXISTS payroll_accum_unique_uk;

-- Drop main table and dependent constraints
DROP TABLE IF EXISTS payroll_accumulation CASCADE;

-- Finally drop the custom domain introduced in the up migration
DROP DOMAIN IF EXISTS accum_type;
