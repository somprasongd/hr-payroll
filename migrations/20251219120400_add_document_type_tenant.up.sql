-- Add hybrid document types support: system types + custom company types
-- System types (is_system=true, company_id=null): managed by superadmin, visible to all
-- Custom types (is_system=false, company_id=uuid): managed by company admin, visible to that company only

-- Add columns for tenant isolation
ALTER TABLE employee_document_type 
  ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark existing document types as system types (they were created before multi-tenancy)
UPDATE employee_document_type 
SET is_system = TRUE 
WHERE company_id IS NULL;

-- Drop old unique index (code only)
DROP INDEX IF EXISTS employee_document_type_code_active_uk;

-- Create new unique index: code must be unique per company (or globally for system types)
-- Using COALESCE to treat NULL company_id as a fixed UUID for system types
CREATE UNIQUE INDEX employee_document_type_code_uk 
  ON employee_document_type (
    lower(code), 
    COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE deleted_at IS NULL;

-- Add index for efficient tenant filtering
CREATE INDEX employee_document_type_company_idx 
  ON employee_document_type (company_id) 
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN employee_document_type.company_id IS 'NULL for system types, company UUID for custom types';
COMMENT ON COLUMN employee_document_type.is_system IS 'TRUE = system type (superadmin manages), FALSE = custom type (company admin manages)';
