-- Update view v_employee_documents_expiring to include tenant columns
DROP VIEW IF EXISTS v_employee_documents_expiring;

CREATE OR REPLACE VIEW v_employee_documents_expiring AS
SELECT 
  ed.id AS document_id,
  ed.employee_id,
  e.employee_number,
  e.first_name,
  e.last_name,
  e.company_id,
  e.branch_id,
  edt.code AS document_type_code,
  edt.name_th AS document_type_name_th,
  edt.name_en AS document_type_name_en,
  ed.file_name,
  ed.expiry_date,
  ed.expiry_date - CURRENT_DATE AS days_until_expiry
FROM employee_document ed
JOIN employees e ON e.id = ed.employee_id
JOIN employee_document_type edt ON edt.id = ed.document_type_id
WHERE ed.deleted_at IS NULL
  AND e.deleted_at IS NULL
  AND e.employment_end_date IS NULL
  AND ed.expiry_date IS NOT NULL
  AND ed.expiry_date >= CURRENT_DATE
ORDER BY ed.expiry_date ASC;
