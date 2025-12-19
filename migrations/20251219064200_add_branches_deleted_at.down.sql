-- =========================================
-- Remove soft delete support for branches
-- =========================================

DROP INDEX IF EXISTS branches_deleted_at_idx;
ALTER TABLE branches DROP COLUMN IF EXISTS deleted_by;
ALTER TABLE branches DROP COLUMN IF EXISTS deleted_at;
