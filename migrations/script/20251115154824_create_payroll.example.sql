-- 0) เตรียมข้อมูลพื้นฐาน
BEGIN;

-- สร้าง user ทดสอบ (ถ้ามีอยู่แล้วจะไม่สร้างซ้ำ)
INSERT INTO users (username, password_hash, user_role)
VALUES ('payroll_tester', 'x', 'admin')
ON CONFLICT (username) DO NOTHING;

-- เตรียม employee_type ถ้ายังไม่มี (full_time / part_time)
INSERT INTO employee_type(code, name_th)
VALUES ('full_time','ประจำ'),('part_time','พาร์ทไทม์')
ON CONFLICT (code) DO NOTHING;

-- เตรียม id_document_type ถ้ายังไม่มี
INSERT INTO id_document_type(code, name_th)
VALUES ('th_cid','บัตรประชาชน')
ON CONFLICT (code) DO NOTHING;

-- สร้างพนักงาน full-time 1 คน สำหรับทดสอบ
INSERT INTO employees (
  employee_number, title_id, first_name, last_name,
  id_document_type_id, id_document_number,
  phone, email,
  employee_type_id, base_pay_amount,
  employment_start_date,
  sso_contribute, sso_declared_wage,
  withhold_tax,
  allow_housing, allow_water, allow_electric, allow_internet,
  created_by, updated_by
)
SELECT
  'EMP-PR-01',
  (SELECT id FROM person_title ORDER BY id LIMIT 1),  -- ใช้ค่าแรกๆ ที่มีอยู่
  'สมชาย','ทำเงินเดือน',
  (SELECT id FROM id_document_type WHERE code='th_cid'),
  '1101700000001',
  '0800000001','emppr01@example.com',
  (SELECT id FROM employee_type WHERE code='full_time'),
  30000.00,
  DATE '2024-01-05',
  TRUE, 30000.00,
  TRUE,
  TRUE, TRUE, TRUE, TRUE,
  (SELECT id FROM users WHERE username='payroll_tester'),
  (SELECT id FROM users WHERE username='payroll_tester')
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE employee_number='EMP-PR-01');

COMMIT;

-- 1) สร้างงวดทำเงินเดือนใหม่ใน payroll_run

-- ตัวอย่าง: งวด ก.ย. 2025 จ่ายวันที่ 2025-09-30
-- ช่วงประเมิน: 2025-08-26 – 2025-09-25

BEGIN;

INSERT INTO payroll_run (
  payroll_month_date,    -- งวด ก.ย. 2025 -> ต้องเป็นวันแรกของเดือน
  period_start_date,
  pay_date,
  social_security_rate_employee,
  social_security_rate_employer,
  status,
  created_by, updated_by
)
VALUES (
  DATE '2025-09-01',
  DATE '2025-08-26',
  DATE '2025-09-30',
  0.05000,   -- ตัวอย่าง: สปส. 5% ลูกจ้าง
  0.05000,   -- ตัวอย่าง: สปส. 5% นายจ้าง (เผื่อรายงาน)
  'pending',
  (SELECT id FROM users WHERE username='payroll_tester'),
  (SELECT id FROM users WHERE username='payroll_tester')
)
RETURNING id;

COMMIT;

-- 2) ใส่รายการพนักงานใน payroll_run_item (ทดสอบ trigger คำนวณ)

-- สมมติใช้ payroll_run ตัวล่าสุด:

-- เงินเดือน: 30,000

-- OT: 10 ชม. = 1,500

-- ค่าห้อง: 1,000

-- เบี้ยไม่สาย: 500

-- เบี้ยไม่ลา: 1,000

-- โบนัส: 5,000

-- รายได้อื่น: 2,000 (ใน JSON)

-- ประกันสังคมสะสมก่อนหน้า: 9,000, เดือนนี้ 750

-- ภาษีสะสมก่อนหน้า: 5,000, เดือนนี้ 800

-- กองทุนสะสมก่อนหน้า: 10,000, เดือนนี้ 500

-- ค่าน้ำ/ไฟ/เน็ต รวมแล้วใน amount

-- เบิกล่วงหน้า: 3,000 จ่ายคืนเดือนนี้ 1,000 → ส่วนต่างควรเป็น 2,000

-- ยอดกู้ก่อนหน้า: 20,000 จ่ายกู้ในเดือนนี้ 2,000 (ใน JSON) → คงเหลือควรเป็น 20,000 + 2,000 (advance_diff) - 2,000 = 20,000

BEGIN;

INSERT INTO payroll_run_item (
  run_id,
  employee_id,
  employee_type_id,

  salary_amount,
  ot_hours, ot_amount,
  housing_allowance,
  attendance_bonus_nolate,
  attendance_bonus_noleave,
  bonus_amount,
  leave_compensation_amount,
  others_income,

  leave_days_qty,      leave_days_deduction,
  leave_double_qty,    leave_double_deduction,
  leave_hours_qty,     leave_hours_deduction,
  late_minutes_qty,    late_minutes_deduction,

  sso_declared_wage,
  sso_accum_prev,
  sso_month_amount,

  tax_accum_prev,
  tax_month_amount,

  pf_accum_prev,
  pf_month_amount,

  water_meter_prev, water_meter_curr, water_amount,
  electric_meter_prev, electric_meter_curr, electric_amount,
  internet_amount,

  advance_amount,
  advance_repay_amount,

  loan_outstanding_prev,
  loan_repayments,

  created_by, updated_by
)
VALUES (
  (SELECT id FROM payroll_run WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 1),
  (SELECT id FROM employees WHERE employee_number='EMP-PR-01'),
  (SELECT id FROM employee_type WHERE code='full_time'),

  30000.00,
  10.00, 1500.00,
  1000.00,
  500.00,
  1000.00,
  5000.00,
  0.00,
  '[{"name":"เบี้ยเลี้ยงปฏิบัติงานพิเศษ","value":2000.00}]'::jsonb,

  1.0, 1000.00,
  0.0, 0.00,
  2.0, 800.00,
  30,  300.00,

  30000.00,
  9000.00,
  750.00,

  5000.00,
  800.00,

  10000.00,
  500.00,

  1234.0, 1250.0, 160.00,
  2300.0, 2350.0, 300.00,
  400.00,

  3000.00,
  1000.00,

  20000.00,
  '[{"name":"ผ่อนหนี้กู้ ก.ย.65","value":2000.00}]'::jsonb,

  (SELECT id FROM users WHERE username='payroll_tester'),
  (SELECT id FROM users WHERE username='payroll_tester')
)
RETURNING id;

COMMIT;

-- ดูค่า ที่ trigger คำนวณให้:

SELECT
  pri.id,
  e.employee_number,
  pri.income_total,
  pri.sso_accum_prev, pri.sso_month_amount, pri.sso_accum_total,
  pri.tax_accum_prev, pri.tax_month_amount, pri.tax_accum_total,
  pri.pf_accum_prev,  pri.pf_month_amount,  pri.pf_accum_total,
  pri.advance_amount, pri.advance_repay_amount, pri.advance_diff_amount,
  pri.loan_outstanding_prev, pri.loan_outstanding_total
FROM payroll_run_item pri
JOIN employees e ON e.id = pri.employee_id
ORDER BY pri.id DESC
LIMIT 5;

-- คาดหวัง (เช็ค logic):

-- income_total
-- = 30,000 + 1,500 + 1,000 + 500 + 1,000 + 5,000 + 0 + 2,000
-- = 41,000

-- sso_accum_total = 9,000 + 750 = 9,750

-- tax_accum_total = 5,000 + 800 = 5,800

-- pf_accum_total = 10,000 + 500 = 10,500

-- advance_diff_amount = 3,000 - 1,000 = 2,000

-- loan_outstanding_total = 20,000 + 2,000 - 2,000 = 20,000

-- 3) ทดสอบ UPDATE แล้วดู trigger คำนวณใหม่

-- เช่น เพิ่ม bonus_amount เป็น 8,000 และเพิ่ม tax_month_amount เป็น 1,000

BEGIN;

UPDATE payroll_run_item
SET bonus_amount = 8000.00,
    tax_month_amount = 1000.00,
    updated_by = (SELECT id FROM users WHERE username='payroll_tester')
WHERE id = (
  SELECT id FROM payroll_run_item ORDER BY id DESC LIMIT 1
);

COMMIT;

SELECT
  pri.id,
  pri.income_total,
  pri.tax_accum_prev, pri.tax_month_amount, pri.tax_accum_total
FROM payroll_run_item pri
ORDER BY pri.id DESC
LIMIT 1;

-- คาดหวังใหม่:

-- income_total เพิ่มอีก 3,000 (จากโบนัสเดิม 5,000 → 8,000)

-- tax_accum_total = 5,000 + 1,000 = 6,000

-- 4) เปลี่ยนสถานะ payroll_run เป็น pending → approved และลองแก้ item (ควรถูก block)
-- (สถานะเริ่มต้นของตัวอย่างคือ pending แล้ว)

-- ยังสามารถแก้ไข item ได้ (เพราะ run = pending)
UPDATE payroll_run_item
SET ot_hours = 12.00,
    ot_amount = 1800.00,
    updated_by = (SELECT id FROM users WHERE username='payroll_tester')
WHERE run_id = (SELECT id FROM payroll_run ORDER BY id DESC LIMIT 1)
  AND employee_id = (SELECT id FROM employees WHERE employee_number='EMP-PR-01');

SELECT id, ot_hours, ot_amount, income_total
FROM payroll_run_item
WHERE run_id = (SELECT id FROM payroll_run ORDER BY id DESC LIMIT 1)
ORDER BY id DESC
LIMIT 1;

-- อนุมัติงวด (ต้องใส่ approved_by ไม่งั้น trigger จะ error)
UPDATE payroll_run
SET status      = 'approved',
    approved_by = (SELECT id FROM users WHERE username='payroll_tester'),
    updated_by  = (SELECT id FROM users WHERE username='payroll_tester')
WHERE id = (SELECT id FROM payroll_run ORDER BY id DESC LIMIT 1);

-- ลองแก้ item หลังอนุมัติ -> ควร ERROR: Items can be edited only when payroll_run is pending
UPDATE payroll_run_item
SET bonus_amount = 9999.00,
    updated_by   = (SELECT id FROM users WHERE username='payroll_tester')
WHERE run_id = (SELECT id FROM payroll_run ORDER BY id DESC LIMIT 1)
  AND employee_id = (SELECT id FROM employees WHERE employee_number='EMP-PR-01');

-- 5) ทดสอบฟังก์ชัน get_latest_payroll_pay_date()
SELECT get_latest_payroll_pay_date() AS latest_pay_date;

-- 6) ทดสอบ payroll_accumulation (ยอดสะสม)

-- สมมติ:

-- สปส. ปี 2025 สะสมเป็น 9,750

-- ภาษี ปี 2025 สะสมเป็น 6,000

-- PF สะสม (ไม่ระบุปี) เป็น 10,500

BEGIN;

-- สปส. 2025
INSERT INTO payroll_accumulation (employee_id, accum_type, accum_year, amount, updated_by)
VALUES (
  (SELECT id FROM employees WHERE employee_number='EMP-PR-01'),
  'sso',
  2025,
  9750.00,
  (SELECT id FROM users WHERE username='payroll_tester')
)
ON CONFLICT (employee_id, accum_type, COALESCE(accum_year,-1))
DO UPDATE SET
  amount     = EXCLUDED.amount,
  updated_at = now(),
  updated_by = EXCLUDED.updated_by;

-- ภาษี 2025
INSERT INTO payroll_accumulation (employee_id, accum_type, accum_year, amount, updated_by)
VALUES (
  (SELECT id FROM employees WHERE employee_number='EMP-PR-01'),
  'tax',
  2025,
  6000.00,
  (SELECT id FROM users WHERE username='payroll_tester')
)
ON CONFLICT (employee_id, accum_type, COALESCE(accum_year,-1))
DO UPDATE SET
  amount     = EXCLUDED.amount,
  updated_at = now(),
  updated_by = EXCLUDED.updated_by;

-- PF (ไม่มีปี)
INSERT INTO payroll_accumulation (employee_id, accum_type, accum_year, amount, updated_by)
VALUES (
  (SELECT id FROM employees WHERE employee_number='EMP-PR-01'),
  'pf',
  NULL,
  10500.00,
  (SELECT id FROM users WHERE username='payroll_tester')
)
ON CONFLICT (employee_id, accum_type, COALESCE(accum_year,-1))
DO UPDATE SET
  amount     = EXCLUDED.amount,
  updated_at = now(),
  updated_by = EXCLUDED.updated_by;

COMMIT;

SELECT *
FROM payroll_accumulation
WHERE employee_id = (SELECT id FROM employees WHERE employee_number='EMP-PR-01')
ORDER BY accum_type, accum_year NULLS LAST;
