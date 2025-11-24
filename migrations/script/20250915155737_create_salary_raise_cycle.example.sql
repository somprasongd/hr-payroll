-- 1) สร้างข้อมูล worklog_ft สำหรับ EMP-001 ภายใน/นอกช่วง
-- ภายในช่วง (จะถูกนับใน snapshot)
INSERT INTO worklog_ft (employee_id, entry_type, work_date, quantity, status,
                        created_by, updated_by)
VALUES
  (
  (SELECT id FROM employees WHERE employee_number='EMP-001'),
  'late', DATE '2025-09-05', 15, 'approved',
  (SELECT id FROM users WHERE username='admin' ORDER BY id DESC LIMIT 1),
  (SELECT id FROM users WHERE username='admin' ORDER BY id DESC LIMIT 1)
  ),
  (
  (SELECT id FROM employees WHERE employee_number='EMP-001'),
  'leave_day', DATE '2025-09-10', 1, 'approved',
  (SELECT id FROM users WHERE username='admin' ORDER BY id DESC LIMIT 1),
  (SELECT id FROM users WHERE username='admin' ORDER BY id DESC LIMIT 1)
  ),
  (
  (SELECT id FROM employees WHERE employee_number='EMP-001'),
  'leave_hours', DATE '2025-09-12', 2.5, 'pending',
  (SELECT id FROM users WHERE username='admin' ORDER BY id DESC LIMIT 1),
  (SELECT id FROM users WHERE username='admin' ORDER BY id DESC LIMIT 1)
  ),
  (
  (SELECT id FROM employees WHERE employee_number='EMP-001'),
  'ot', DATE '2025-09-18', 3.0, 'approved',
  (SELECT id FROM users WHERE username='admin' ORDER BY id DESC LIMIT 1),
  (SELECT id FROM users WHERE username='admin' ORDER BY id DESC LIMIT 1)
  );

-- นอกช่วง (ต้องไม่ถูกนับ)
INSERT INTO worklog_ft (employee_id, entry_type, work_date, quantity, status,
                        created_by, updated_by)
VALUES
  (
  (SELECT id FROM employees WHERE employee_number='EMP-001'),
  'late', DATE '2025-08-31', 5, 'approved',
  (SELECT id FROM users WHERE username='admin' ORDER BY id DESC LIMIT 1),
  (SELECT id FROM users WHERE username='admin' ORDER BY id DESC LIMIT 1)
  );

-- 2) สร้างรอบปรับเงินเดือน (pending) → จะ auto สร้าง salary_raise_item พร้อม snapshot
INSERT INTO salary_raise_cycle (period_start_date, period_end_date, status,
                                created_by, updated_by)
VALUES (DATE '2025-09-01', DATE '2025-09-30', 'pending',
        (SELECT id FROM users WHERE username='admin' ORDER BY id DESC LIMIT 1),
        (SELECT id FROM users WHERE username='admin' ORDER BY id DESC LIMIT 1))
RETURNING id;

-- ตรวจผลการสร้างรายการ (ควรมีเฉพาะพนักงานประจำ 2 คน)
SELECT i.id, e.employee_number, i.tenure_days,
      i.current_salary, i.current_sso_wage,
      i.late_minutes, i.leave_days, i.leave_double_days, i.leave_hours, i.ot_hours
FROM salary_raise_item i
JOIN employees e ON e.id = i.employee_id
WHERE i.cycle_id = (SELECT id FROM salary_raise_cycle WHERE status='pending' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1)
ORDER BY e.employee_number;

-- 3) ทดสอบ “อัปเดต worklog_ft” แล้ว snapshot รีคอมพิวต์อัตโนมัติ (เฉพาะรอบที่ยัง pending)
-- 3.1 เพิ่ม OT ใหม่ 2 ชั่วโมงในช่วง → ot_hours เพิ่ม
INSERT INTO worklog_ft (employee_id, entry_type, work_date, quantity, status,
                        created_by, updated_by)
VALUES
  (
  (SELECT id FROM employees WHERE employee_number='EMP-001'),
  'ot', DATE '2025-09-20', 2.0, 'approved',
  (SELECT id FROM users WHERE username='admin' ORDER BY id DESC LIMIT 1),
  (SELECT id FROM users WHERE username='admin' ORDER BY id DESC LIMIT 1)
  );

-- ตรวจดู snapshot อีกครั้ง
SELECT e.employee_number, i.late_minutes, i.leave_days, i.leave_hours, i.ot_hours
FROM salary_raise_item i
JOIN employees e ON e.id = i.employee_id
WHERE i.cycle_id = (SELECT id FROM salary_raise_cycle WHERE status='pending' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1)
  AND e.employee_number='EMP-001';
-- คาดว่า ot_hours เดิม 3.00 จะเป็น 5.00

-- 3.2 Soft delete รายการที่เป็น pending → snapshot ลดลง
-- ทำรายการ leave_hours (2.5) ที่เป็น pending ให้ถูกลบ (เฉพาะ pending ถึงลบได้)
UPDATE worklog_ft
SET deleted_at = now(), deleted_by = (SELECT id FROM users WHERE username='admin' ORDER BY id DESC LIMIT 1)
WHERE employee_id = (SELECT id FROM employees WHERE employee_number='EMP-001')
  AND entry_type = 'leave_hours'
  AND work_date  = DATE '2025-09-12'
  AND status     = 'pending'
  AND deleted_at IS NULL;

-- ตรวจดู snapshot อีกครั้ง
SELECT e.employee_number, i.late_minutes, i.leave_days, i.leave_hours, i.ot_hours
FROM salary_raise_item i
JOIN employees e ON e.id = i.employee_id
WHERE i.cycle_id = (SELECT id FROM salary_raise_cycle WHERE status='pending' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1)
  AND e.employee_number='EMP-001';
-- คาดว่า leave_hours จาก 2.50 จะกลายเป็น 0.00

-- 4) ปรับข้อมูลขึ้นเงินเดือนใน salary_raise_item → ควร sync ไปที่ employees ทันที
-- ปรับ EMP-001: เพิ่ม 5% และ +500 บาท และตั้งฐาน สปส. ใหม่
UPDATE salary_raise_item i
SET raise_percent = 5.00,
    raise_amount  = 500.00,
    new_sso_wage  = 30500.00,  -- ตัวอย่าง
    updated_by    = (SELECT id FROM users WHERE username='admin' ORDER BY id DESC LIMIT 1)
WHERE i.cycle_id = (SELECT id FROM salary_raise_cycle WHERE status='pending' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1)
  AND i.employee_id = (SELECT id FROM employees WHERE employee_number='EMP-001');

-- ตรวจดู new_salary (คำนวนอัตโนมัติ) และดูว่า employees ถูกอัปเดตหรือยัง
SELECT e.employee_number, i.current_salary, i.raise_percent, i.raise_amount, i.new_salary, i.new_sso_wage
FROM salary_raise_item i
JOIN employees e ON e.id = i.employee_id
WHERE i.cycle_id = (SELECT id FROM salary_raise_cycle WHERE status='pending' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1)
  AND e.employee_number='EMP-001';

SELECT employee_number, base_pay_amount, sso_declared_wage
FROM employees
WHERE employee_number='EMP-001';
-- คาดว่า base_pay_amount จะเท่ากับ new_salary และ sso_declared_wage = new_sso_wage

-- 5) อนุมัติรอบ → ห้ามแก้ไข item และ worklog_ft update จะไม่ทำอะไร (เพราะไม่มี pending cycle)
-- อนุมัติรอบ
UPDATE salary_raise_cycle
SET status = 'approved',
    updated_by = (SELECT id FROM users WHERE username='admin' ORDER BY id DESC LIMIT 1)
WHERE status='pending' AND deleted_at IS NULL;

-- ลองแก้ item ควรถูกปฏิเสธ
UPDATE salary_raise_item i
SET raise_amount = 999.00,
    updated_by = (SELECT id FROM users WHERE username='admin' ORDER BY id DESC LIMIT 1)
WHERE i.cycle_id = (SELECT id FROM salary_raise_cycle ORDER BY id DESC LIMIT 1)
  AND i.employee_id = (SELECT id FROM employees WHERE employee_number='EMP-001');
-- คาดว่า ERROR: Items can be edited only when cycle status is pending

-- ลองเพิ่ม worklog_ft ในช่วงเดิมอีก (ไม่ควรทำให้ snapshot เปลี่ยน เพราะไม่มี pending cycle แล้ว)
INSERT INTO worklog_ft (employee_id, entry_type, work_date, quantity, status,
                        created_by, updated_by)
VALUES
  (
  (SELECT id FROM employees WHERE employee_number='EMP-001'),
  'ot', DATE '2025-09-25', 1.5, 'approved',
  (SELECT id FROM users WHERE username='admin' ORDER BY id DESC LIMIT 1),
  (SELECT id FROM users WHERE username='admin' ORDER BY id DESC LIMIT 1)
  );

-- ตรวจ snapshot เดิม (ควรคงเดิมหลังอนุมัติ)
SELECT e.employee_number, i.late_minutes, i.leave_days, i.leave_hours, i.ot_hours
FROM salary_raise_item i
JOIN employees e ON e.id = i.employee_id
WHERE i.cycle_id = (SELECT id FROM salary_raise_cycle ORDER BY id DESC LIMIT 1)
  AND e.employee_number='EMP-001';
