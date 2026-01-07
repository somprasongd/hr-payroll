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

-- Update enriched view to include company_id and branch_id
DROP VIEW IF EXISTS v_employees_active_enriched;
CREATE OR REPLACE VIEW v_employees_active_enriched AS
SELECT
  e.id AS employee_id,
  e.employee_number,
  e.company_id,
  e.branch_id,
  pt.code AS title_code, pt.name_th AS title_name_th,
  e.first_name, e.last_name,
  e.nickname,
  (pt.name_th || e.first_name || ' ' || e.last_name || COALESCE(' (' || e.nickname || ')', '')) AS full_name_th,
  idt.code AS id_document_type_code, idt.name_th AS id_document_type_name_th,
  e.id_document_number,
  e.id_document_other_description,
  e.phone, e.email,
  e.photo_id,
  et.code AS employee_type_code, et.name_th AS employee_type_name_th,
  d.id AS department_id, d.code AS department_code, d.name_th AS department_name_th,
  ep.id AS position_id, ep.code AS position_code, ep.name_th AS position_name_th,
  e.base_pay_amount,
  CASE et.code
    WHEN 'full_time' THEN 'monthly'
    WHEN 'part_time' THEN 'hourly'
    ELSE 'unknown'
  END AS pay_basis,
  CASE et.code
    WHEN 'full_time' THEN 'บาท/เดือน'
    WHEN 'part_time' THEN 'บาท/ชั่วโมง'
    ELSE NULL
  END AS pay_unit_th,
  e.employment_start_date,
  e.bank_name, e.bank_account_no,
  e.sso_contribute, e.sso_declared_wage,
  e.sso_hospital_name,
  e.provident_fund_contribute, e.provident_fund_rate_employee, e.provident_fund_rate_employer,
  e.withhold_tax,
  e.allow_housing, e.allow_water, e.allow_electric, e.allow_internet,
  e.allow_doctor_fee, e.allow_attendance_bonus_nolate, e.allow_attendance_bonus_noleave,
  e.created_at, e.created_by, e.updated_at, e.updated_by
FROM employees e
JOIN person_title      pt  ON pt.id  = e.title_id
JOIN id_document_type  idt ON idt.id = e.id_document_type_id
JOIN employee_type     et  ON et.id  = e.employee_type_id
LEFT JOIN department   d   ON d.id   = e.department_id
LEFT JOIN employee_position ep ON ep.id = e.position_id
WHERE e.employment_end_date IS NULL
  AND e.deleted_at IS NULL;
