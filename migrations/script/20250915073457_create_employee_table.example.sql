BEGIN;
-- ========== INSERT: พนักงานใหม่ 3 คน ==========

WITH admin_user AS (
  SELECT id AS admin_id FROM users WHERE username='admin' LIMIT 1
)
-- 1) Full-time: นาย สมชาย ศรีสุข
INSERT INTO employees (
  employee_number, title_id, first_name, last_name,
  id_document_type_id, id_document_number, phone, email,
  employee_type_id, base_pay_amount,
  employment_start_date, employment_end_date,
  bank_name, bank_account_no,
  sso_contribute, sso_declared_wage,
  withhold_tax,
  allow_housing, allow_water, allow_electric, allow_internet,
  created_by, updated_by
)
VALUES (
  'EMP-001',
  (SELECT id FROM person_title WHERE code='mr'),
  'สมชาย','ศรีสุข',
  (SELECT id FROM id_document_type WHERE code='th_cid'),
  '1103701234567','0812345678','somchai@example.com',
  (SELECT id FROM employee_type WHERE code='full_time'),
  30000.00,
  DATE '2024-06-01', NULL,
  'KBank','123-4-56789-0',
  TRUE, 30000.00,
  TRUE,
  TRUE, TRUE, TRUE, TRUE,
  (SELECT admin_id FROM admin_user), (SELECT admin_id FROM admin_user)
),
-- 2) Full-time: นาง นภพร บุญมี
(
  'EMP-002',
  (SELECT id FROM person_title WHERE code='mrs'),
  'นภพร','บุญมี',
  (SELECT id FROM id_document_type WHERE code='th_cid'),
  '1101709876543','0890001122','napaporn@example.com',
  (SELECT id FROM employee_type WHERE code='full_time'),
  28000.00,
  DATE '2024-07-15', NULL,
  'SCB','111-2-33333-4',
  TRUE, 28000.00,
  TRUE,
  FALSE, TRUE, FALSE, FALSE,
  (SELECT admin_id FROM admin_user), (SELECT admin_id FROM admin_user)
),
-- 3) Part-time: นางสาว กันยารัตน์ วงศ์ดี
(
  'PT-1001',
  (SELECT id FROM person_title WHERE code='ms'),
  'กันยารัตน์','วงศ์ดี',
  (SELECT id FROM id_document_type WHERE code='th_cid'),
  '1100401122334','0869990001','kanyarat@example.com',
  (SELECT id FROM employee_type WHERE code='part_time'),
  120.00,                              -- บาท/ชั่วโมง
  DATE '2025-02-01', NULL,
  NULL, NULL,
  FALSE, NULL,                         -- ไม่ส่ง สปส.
  FALSE,                               -- ไม่หัก ณ ที่จ่าย (ตัวอย่าง)
  FALSE, FALSE, FALSE, TRUE,
  (SELECT admin_id FROM admin_user), (SELECT admin_id FROM admin_user)
)
RETURNING id;

-- ========== UPDATE: ลาออก 1 คน ==========
WITH admin_user AS (
  SELECT id AS admin_id FROM users WHERE username='admin' LIMIT 1
)
-- ให้ EMP-002 ลาออกวันที่ 2025-09-30
UPDATE employees
SET employment_end_date = DATE '2025-09-30',
    updated_by = (SELECT admin_id FROM admin_user)
WHERE employee_number = 'EMP-002'
  AND employment_end_date IS NULL
  AND deleted_at IS NULL;

-- ========== SOFT DELETE: 1 คน ==========
WITH admin_user AS (
  SELECT id AS admin_id FROM users WHERE username='admin' LIMIT 1
)
-- ลบชั่วคราว PT-1001
UPDATE employees
SET deleted_at = now(),
    deleted_by = (SELECT admin_id FROM admin_user)
WHERE employee_number = 'PT-1001'
  AND deleted_at IS NULL;

COMMIT;

-- คนที่ยัง "ทำงานอยู่" และ "ไม่ถูกลบ"
SELECT employee_number, first_name, last_name
FROM v_employees_active
ORDER BY employee_number;

-- คนที่ลาออกแล้ว
SELECT employee_number, first_name, last_name, employment_end_date
FROM employees
WHERE employment_end_date IS NOT NULL AND deleted_at IS NULL;

-- คนที่ถูก soft delete
SELECT employee_number, first_name, last_name, deleted_at
FROM employees
WHERE deleted_at IS NOT NULL;
