-- =============================================
-- Down migration for banks
-- =============================================

-- Drop and recreate trigger with bank_name
DROP TRIGGER IF EXISTS tg_sync_payroll_emp ON employees;

-- Drop views
DROP VIEW IF EXISTS v_employees_active_enriched CASCADE;
DROP VIEW IF EXISTS v_employees_active CASCADE;

-- Revert employees table
ALTER TABLE employees
DROP COLUMN IF EXISTS bank_id,
ADD COLUMN bank_name TEXT NULL;

-- Re-add the constraint
ALTER TABLE employees
ADD CONSTRAINT employees_bank_pair CHECK (bank_account_no IS NULL OR bank_name IS NOT NULL);

-- Recreate original views with bank_name
CREATE OR REPLACE VIEW v_employees_active AS
SELECT
  e.*
FROM employees e
WHERE e.employment_end_date IS NULL
  AND e.deleted_at IS NULL
WITH LOCAL CHECK OPTION;

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

-- Recreate original trigger with bank_name
CREATE TRIGGER tg_sync_payroll_emp
AFTER UPDATE OF base_pay_amount, sso_contribute, sso_declared_wage, withhold_tax,
  allow_housing, allow_water, allow_electric, allow_internet, allow_doctor_fee,
  allow_attendance_bonus_nolate, allow_attendance_bonus_noleave,
  provident_fund_contribute, provident_fund_rate_employee, provident_fund_rate_employer,
  department_id, position_id, bank_name, bank_account_no, employee_type_id,
  employment_end_date, deleted_at, company_id, branch_id
ON employees
FOR EACH ROW
EXECUTE FUNCTION sync_payroll_on_employee_change();

-- Revert debt_txn table
ALTER TABLE debt_txn
DROP COLUMN IF EXISTS bank_id;

-- Drop tables
DROP TABLE IF EXISTS company_bank_settings;
DROP TABLE IF EXISTS banks;
