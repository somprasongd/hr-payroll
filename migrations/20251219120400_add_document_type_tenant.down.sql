-- Rollback hybrid document types changes

-- Drop indexes
DROP INDEX IF EXISTS employee_document_type_company_idx;
DROP INDEX IF EXISTS employee_document_type_code_uk;

-- Recreate original unique index (code only)
CREATE UNIQUE INDEX employee_document_type_code_active_uk
  ON employee_document_type (lower(code))
  WHERE deleted_at IS NULL;

-- Remove columns
ALTER TABLE employee_document_type DROP COLUMN IF EXISTS is_system;
ALTER TABLE employee_document_type DROP COLUMN IF EXISTS company_id;
