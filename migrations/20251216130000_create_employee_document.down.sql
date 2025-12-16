-- Rollback employee document tables

DROP VIEW IF EXISTS v_employee_documents_expiring;

DROP TRIGGER IF EXISTS tg_employee_document_set_updated ON employee_document;
DROP INDEX IF EXISTS employee_document_checksum_uk;
DROP INDEX IF EXISTS employee_document_expiry_idx;
DROP INDEX IF EXISTS employee_document_type_idx;
DROP INDEX IF EXISTS employee_document_employee_idx;
DROP TABLE IF EXISTS employee_document;

DROP TRIGGER IF EXISTS tg_employee_document_type_set_updated ON employee_document_type;
DROP INDEX IF EXISTS employee_document_type_code_active_uk;
DROP TABLE IF EXISTS employee_document_type;
