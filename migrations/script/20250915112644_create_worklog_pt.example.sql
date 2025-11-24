-- 1) ลงเวลา Part-time
-- 1.1 เพิ่มรายการลงเวลา (3 วันตัวอย่าง)
BEGIN;

WITH ctx AS (
  SELECT e.id AS emp_id, u.id AS admin_id
  FROM employees e
  JOIN users u ON u.username = 'admin'
  WHERE e.employee_number = 'PT-1001'
)
INSERT INTO worklog_pt (
  employee_id, work_date,
  morning_in, morning_out,
  evening_in, evening_out,
  status, created_by, updated_by
)
VALUES
  -- วันแรก ทำทั้งเช้า-เย็น 09:00–12:30 และ 14:00–18:45
  ((SELECT emp_id FROM ctx), DATE '2025-09-01',
  TIME '09:00', TIME '12:30',
  TIME '14:00', TIME '18:45',
  'pending', (SELECT admin_id FROM ctx), (SELECT admin_id FROM ctx)),

  -- วันที่สอง เฉพาะรอบเช้า 09:00–12:00
  ((SELECT emp_id FROM ctx), DATE '2025-09-02',
  TIME '09:00', TIME '12:00',
  NULL, NULL,
  'pending', (SELECT admin_id FROM ctx), (SELECT admin_id FROM ctx)),

  -- วันที่สาม เฉพาะรอบเย็น 13:30–18:00
  ((SELECT emp_id FROM ctx), DATE '2025-09-03',
  NULL, NULL,
  TIME '13:30', TIME '18:00',
  'pending', (SELECT admin_id FROM ctx), (SELECT admin_id FROM ctx));

COMMIT;

-- 1.2 อนุมัติรายการ (จาก pending → approved)
UPDATE worklog_pt
SET status = 'approved', updated_by = (SELECT id FROM users WHERE username='admin')
WHERE employee_id = (SELECT id FROM employees WHERE employee_number='PT-1001')
  AND work_date BETWEEN DATE '2025-09-01' AND DATE '2025-09-03'
  AND status = 'pending'
  AND deleted_at IS NULL;

-- 1.3 ค้นหาตามช่วงวันที่ + สถานะ
SELECT id, work_date, total_hours, status
FROM worklog_pt
WHERE employee_id = (SELECT id FROM employees WHERE employee_number='PT-1001')
  AND work_date BETWEEN DATE '2025-09-01' AND DATE '2025-09-30'
  AND status IN ('pending','approved')          -- หรือระบุสถานะตามต้องการ
  AND deleted_at IS NULL
ORDER BY work_date;

-- 2) รวมจ่าย (Payout) จากรายการที่เลือก
-- 2.1 สร้าง Payout (ล็อกเรทต่อชั่วโมงจากพนักงานตอนสร้าง)
INSERT INTO payout_pt (employee_id, hourly_rate_used, created_by, updated_by)
SELECT e.id, e.base_pay_amount, u.id, u.id
FROM employees e
JOIN users u ON u.username='admin'
WHERE e.employee_number='PT-1001'
RETURNING id;  -- สมมติได้ :payout_id

-- 2.2 เลือกรายการเวลางานมาใส่ Payout
-- เพิ่มรายการช่วง 1–3 ก.ย. เข้าพักจ่าย
INSERT INTO payout_pt_item (payout_id, worklog_id)
SELECT :payout_id, w.id
FROM worklog_pt w
WHERE w.employee_id = (SELECT employee_id FROM payout_pt WHERE id=:payout_id)
  AND w.work_date BETWEEN DATE '2025-09-01' AND DATE '2025-09-03'
  AND w.status IN ('pending')
AND w.deleted_at IS NULL;
-- เมื่อเพิ่มแต่ละรายการ: trigger จะตั้ง worklog.status = 'approved'
-- และคำนวณสรุป total_minutes/total_hours/amount_total ใน payout ให้อัตโนมัติ

-- 2.3 ตรวจดูสรุปยอดใน Payout
SELECT id, total_minutes, total_hours, hourly_rate_used, amount_total, status
FROM payout_pt
WHERE id = :payout_id;


-- 2.4 จ่ายเงิน (to_pay → paid) โดยไม่เปลี่ยนสถานะ worklog เพิ่มเติม
UPDATE payout_pt
SET status='paid',
    paid_by = (SELECT id FROM users WHERE username='admin'),
    paid_at = now(),
    updated_by = (SELECT id FROM users WHERE username='admin')
WHERE id = :payout_id
  AND status='to_pay';
-- trigger จะตรวจบังคับ paid_by/paid_at ให้ครบเท่านั้น (ไม่มีผลกับ worklog)

-- 3) กรณีพิเศษ
-- 3.1 ยกเลิก Payout (soft delete) ขณะยัง to_pay (จะ revert worklog → pending)
UPDATE payout_pt
SET deleted_at = now(),
    deleted_by = (SELECT id FROM users WHERE username='admin'),
    updated_by = (SELECT id FROM users WHERE username='admin')
WHERE id = :payout_id
  AND status='to_pay';
-- trigger จะ revert worklog_pt ที่เป็น 'approved' ให้กลับ 'pending'

-- 3.2 เอารายการออกจาก Payout (ก่อนจ่าย)
DELETE FROM payout_pt_item
WHERE payout_id = :payout_id
  AND worklog_id IN (
      SELECT w.id
      FROM worklog_pt w
      WHERE w.employee_id = (SELECT employee_id FROM payout_pt WHERE id=:payout_id)
        AND w.work_date = DATE '2025-09-03'
  );
-- trigger จะคำนวณยอด payout ใหม่ และเปลี่ยนสถานะ worklog ที่เอาออกจาก 'approved' → 'pending'

-- 3.3 Soft delete รายการลงเวลา (ได้เฉพาะ pending)
UPDATE worklog_pt
SET deleted_at = now(), deleted_by = (SELECT id FROM users WHERE username='admin')
WHERE employee_id = (SELECT id FROM employees WHERE employee_number='PT-1001')
  AND work_date = DATE '2025-09-03'
  AND status = 'pending'
  AND deleted_at IS NULL;

-- 4) รายงานสรุปชั่วโมง (ตัวอย่างคิวรี)
-- 4.1 รวมชั่วโมงตามช่วงวันที่ (เฉพาะไม่ถูกลบ)
SELECT
  e.employee_number,
  SUM(w.total_minutes)::int AS total_minutes,
  ROUND(SUM(w.total_minutes)::numeric / 60.0, 2) AS total_hours
FROM worklog_pt w
JOIN employees e ON e.id = w.employee_id
WHERE w.employee_id = (SELECT id FROM employees WHERE employee_number='PT-1001')
  AND w.work_date BETWEEN DATE '2025-09-01' AND DATE '2025-09-30'
  AND w.deleted_at IS NULL
GROUP BY e.employee_number;

-- 4.2 รายการที่พร้อมจ่าย (approved) ของพนักงานหนึ่งคน
SELECT work_date, total_hours, status
FROM worklog_pt
WHERE employee_id = (SELECT id FROM employees WHERE employee_number='PT-1001')
  AND status = 'approved'
  AND deleted_at IS NULL
ORDER BY work_date;

-- 5 อัปเดตค่าแรงพนักงานเป็นเรทใหม่ → trigger จะซิงก์ payout ที่ to_pay
-- เปลี่ยนเรทเป็น 150.00
UPDATE employees
SET base_pay_amount = 150.00,
    updated_by = (SELECT id FROM users ORDER BY id LIMIT 1)
WHERE employee_number = 'PT-1001';

-- ✅ ทริกเกอร์บน employees จะ:
--   1) อัปเดต payout_pt.hourly_rate_used ทุกใบของพนักงานนี้ที่ status='to_pay'
--   2) เรียก payout_pt_recalc_and_sync() เพื่อคำนวณ amount_total ใหม่

-- ตรวจสอบผลหลังซิงก์
SELECT id, status, total_minutes, total_hours, hourly_rate_used, amount_total
FROM payout_pt
WHERE employee_id = (SELECT id FROM employees WHERE employee_number='PT-1001')
ORDER BY id DESC
LIMIT 1;

-- 6 พิสูจน์ว่า “ใบที่จ่ายแล้ว (paid)” จะไม่โดนเปลี่ยนเรท
-- ทำการจ่าย payout ใบปัจจุบันให้เสร็จ
UPDATE payout_pt
SET status='paid',
    paid_by = (SELECT id FROM users ORDER BY id LIMIT 1),
    paid_at = now(),
    updated_by = (SELECT id FROM users ORDER BY id LIMIT 1)
WHERE employee_id = (SELECT id FROM employees WHERE employee_number='PT-1001')
  AND status='to_pay'
  AND deleted_at IS NULL;

-- สร้าง payout ใหม่รอบถัดไป (ยัง to_pay) แล้วเพิ่มรายการเวลาใหม่ 1 วัน
-- สมมุติลงเวลาเพิ่มอีกวัน
INSERT INTO worklog_pt (
  employee_id, work_date,
  morning_in, morning_out,
  status, created_by, updated_by
)
SELECT e.id, DATE '2025-09-12',
      TIME '09:00', TIME '12:00',
      'pending',
      (SELECT id FROM users ORDER BY id LIMIT 1),
      (SELECT id FROM users ORDER BY id LIMIT 1)
FROM employees e
WHERE e.employee_number='PT-1001';

-- สร้าง payout ใหม่ (ล็อกเรทปัจจุบัน = 150)
INSERT INTO payout_pt (employee_id, hourly_rate_used, created_by, updated_by)
SELECT e.id, e.base_pay_amount,
      (SELECT id FROM users ORDER BY id LIMIT 1),
      (SELECT id FROM users ORDER BY id LIMIT 1)
FROM employees e
WHERE e.employee_number='PT-1001'
RETURNING id AS new_payout_id;

-- เพิ่มรายการวันที่ 2025-09-12 เข้า payout ใหม่
INSERT INTO payout_pt_item (payout_id, worklog_id)
SELECT :payout_id, w.id
FROM worklog_pt w
WHERE w.employee_id = (SELECT id FROM employees WHERE employee_number='PT-1001')
  AND w.work_date = DATE '2025-09-12'
  AND w.status IN ('pending')
  AND w.deleted_at IS NULL;

-- เปลี่ยนเรทพนักงานอีกรอบเป็น 160 (ทดสอบซิงก์เฉพาะใบ to_pay)
UPDATE employees
SET base_pay_amount = 160.00,
    updated_by = (SELECT id FROM users ORDER BY id LIMIT 1)
WHERE employee_number = 'PT-1001';

-- ตรวจสอบ:
-- 1) ใบใหม่ (ยัง to_pay) ควรอัปเดต hourly_rate_used = 160 และ amount_total คำนวณใหม่
-- 2) ใบเก่า (paid) ไม่เปลี่ยนแปลง
SELECT id, status, total_minutes, total_hours, hourly_rate_used, amount_total
FROM payout_pt
WHERE employee_id = (SELECT id FROM employees WHERE employee_number='PT-1001')
ORDER BY id DESC;
