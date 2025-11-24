-- 1) สร้างข้อมูล worklog_ft สำหรับ EMP-002 (ใน/นอกช่วง)
-- จะใช้รอบ 2025-09-01 ถึง 2025-09-30 เป็นช่วง snapshot
-- ในช่วง (จะถูกนับ)
INSERT INTO worklog_ft (employee_id, entry_type, work_date, quantity, status,
                        created_by, updated_by)
VALUES
  (
  (SELECT id FROM employees WHERE employee_number='EMP-002'),
  'late', DATE '2025-09-05', 20, 'approved',
  (SELECT id FROM users WHERE username='admin'),
  (SELECT id FROM users WHERE username='admin')
  ),
  (
  (SELECT id FROM employees WHERE employee_number='EMP-002'),
  'leave_day', DATE '2025-09-10', 1, 'approved',
  (SELECT id FROM users WHERE username='admin'),
  (SELECT id FROM users WHERE username='admin')
  ),
  (
  (SELECT id FROM employees WHERE employee_number='EMP-002'),
  'leave_hours', DATE '2025-09-12', 2.0, 'pending',
  (SELECT id FROM users WHERE username='admin'),
  (SELECT id FROM users WHERE username='admin')
  ),
  (
  (SELECT id FROM employees WHERE employee_number='EMP-002'),
  'ot', DATE '2025-09-18', 3.5, 'approved',
  (SELECT id FROM users WHERE username='admin'),
  (SELECT id FROM users WHERE username='admin')
  );

-- นอกช่วง (ต้องไม่นับ)
INSERT INTO worklog_ft (employee_id, entry_type, work_date, quantity, status,
                        created_by, updated_by)
VALUES
  (
  (SELECT id FROM employees WHERE employee_number='EMP-002'),
  'late', DATE '2025-08-31', 5, 'approved',
  (SELECT id FROM users WHERE username='admin'),
  (SELECT id FROM users WHERE username='admin')
  );

-- 2) สร้างรอบโบนัส (pending) → auto สร้าง bonus_item สำหรับพนักงานประจำทุกคน + snapshot
INSERT INTO bonus_cycle (
  payroll_month_date,         -- เช่น งวด ก.ย. 2025
  period_start_date, period_end_date,
  status,
  created_by, updated_by
) VALUES (
  DATE '2025-09-01',          -- บังคับเป็นวันแรกของเดือนตาม constraint
  DATE '2025-09-01', DATE '2025-09-30',
  'pending',
  (SELECT id FROM users WHERE username='admin'),
  (SELECT id FROM users WHERE username='admin')
)
RETURNING id;

-- ตรวจผล:
SELECT i.id, e.employee_number, i.tenure_days,
      i.current_salary,
      i.late_minutes, i.leave_days, i.leave_double_days, i.leave_hours, i.ot_hours,
      i.bonus_months, i.bonus_amount
FROM bonus_item i
JOIN employees e ON e.id = i.employee_id
WHERE i.cycle_id = (SELECT id FROM bonus_cycle WHERE status='pending' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1)
ORDER BY e.employee_number;

-- 3) ทดสอบ sync snapshot เมื่อ worklog_ft เปลี่ยน (เฉพาะรอบที่ยัง pending)
-- 3.1 เพิ่ม OT เพิ่มเติมในช่วง → ot_hours เพิ่ม
INSERT INTO worklog_ft (employee_id, entry_type, work_date, quantity, status,
                        created_by, updated_by)
VALUES
  (
  (SELECT id FROM employees WHERE employee_number='EMP-002'),
  'ot', DATE '2025-09-20', 2.0, 'approved',
  (SELECT id FROM users WHERE username='admin'),
  (SELECT id FROM users WHERE username='admin')
  );

SELECT e.employee_number, i.late_minutes, i.leave_days, i.leave_hours, i.ot_hours
FROM bonus_item i
JOIN employees e ON e.id = i.employee_id
WHERE i.cycle_id = (SELECT id FROM bonus_cycle WHERE status='pending' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1)
  AND e.employee_number='EMP-002';
-- ot_hours ควรเปลี่ยนจาก 3.50 -> 5.50

-- 3.2 Soft delete แถว leave_hours (ซึ่งเป็น pending) → leave_hours ลดลง
UPDATE worklog_ft
SET deleted_at = now(), deleted_by = (SELECT id FROM users WHERE username='admin')
WHERE employee_id = (SELECT id FROM employees WHERE employee_number='EMP-002')
  AND entry_type = 'leave_hours'
  AND work_date  = DATE '2025-09-12'
  AND status     = 'pending'
  AND deleted_at IS NULL;

SELECT e.employee_number, i.late_minutes, i.leave_days, i.leave_hours, i.ot_hours
FROM bonus_item i
JOIN employees e ON e.id = i.employee_id
WHERE i.cycle_id = (SELECT id FROM bonus_cycle WHERE status='pending' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1)
  AND e.employee_number='EMP-002';
-- leave_hours ควรเปลี่ยนจาก 2.00 -> 0.00

-- 4) ใส่ค่าโบนัส (เดือน/จำนวนเงิน) ใน bonus_item — แก้ไขได้เพราะยัง pending
UPDATE bonus_item i
SET bonus_months = 1.50,           -- 1.5 เดือน
    bonus_amount = 45000.00,       -- ตัวอย่างโปรแกรมคำนวณแล้วส่งมา
    updated_by   = (SELECT id FROM users WHERE username='admin')
WHERE i.cycle_id = (SELECT id FROM bonus_cycle WHERE status='pending' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1)
  AND i.employee_id = (SELECT id FROM employees WHERE employee_number='EMP-002');

SELECT e.employee_number, i.current_salary, i.bonus_months, i.bonus_amount
FROM bonus_item i
JOIN employees e ON e.id = i.employee_id
WHERE i.cycle_id = (SELECT id FROM bonus_cycle WHERE status='pending' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1)
ORDER BY e.employee_number;

-- 5) อนุมัติรอบโบนัส → ห้ามแก้ทั้ง cycle และ item + worklog เปลี่ยนจะไม่กระทบ
UPDATE bonus_cycle
SET status = 'approved',
    updated_by = (SELECT id FROM users WHERE username='admin')
WHERE status='pending' AND deleted_at IS NULL
ORDER BY id DESC
LIMIT 1;

-- ลองแก้ item (ควร ERROR)
UPDATE bonus_item i
SET bonus_amount = 99999.99,
    updated_by   = (SELECT id FROM users WHERE username='admin')
WHERE i.cycle_id = (SELECT id FROM bonus_cycle ORDER BY id DESC LIMIT 1)
  AND i.employee_id = (SELECT id FROM employees WHERE employee_number='EMP-002');

-- ลองเพิ่ม worklog ในช่วงเดิมอีก (ควร "ไม่" ทำให้ snapshot เปลี่ยน เพราะไม่มี pending cycle แล้ว)
INSERT INTO worklog_ft (employee_id, entry_type, work_date, quantity, status,
                        created_by, updated_by)
VALUES
  (
  (SELECT id FROM employees WHERE employee_number='EMP-002'),
  'late', DATE '2025-09-25', 10, 'approved',
  (SELECT id FROM users WHERE username='admin'),
  (SELECT id FROM users WHERE username='admin')
  );

-- เช็ก snapshot หลังอนุมัติ (ควรคงเดิม)
SELECT e.employee_number, i.late_minutes, i.leave_days, i.leave_hours, i.ot_hours, i.bonus_months, i.bonus_amount
FROM bonus_item i
JOIN employees e ON e.id = i.employee_id
WHERE i.cycle_id = (SELECT id FROM bonus_cycle ORDER BY id DESC LIMIT 1)
  AND e.employee_number='EMP-002';

-- 6) ทดลอง constraint: pending ได้ครั้งละ 1 รายการ และ soft delete เฉพาะที่ไม่ approved
-- สร้าง pending cycle ใหม่ (จะสำเร็จเพราะตัวก่อนหน้า approved แล้ว)
INSERT INTO bonus_cycle (
  payroll_month_date, period_start_date, period_end_date, status,
  created_by, updated_by
) VALUES (
  DATE '2025-10-01', DATE '2025-10-01', DATE '2025-10-31', 'pending',
  (SELECT id FROM users WHERE username='admin'),
  (SELECT id FROM users WHERE username='admin')
)
RETURNING id;

-- พยายามสร้าง pending อีกอันทันที -> ควร ERROR (ชน unique partial index)
INSERT INTO bonus_cycle (
  payroll_month_date, period_start_date, period_end_date, status,
  created_by, updated_by
) VALUES (
  DATE '2025-11-01', DATE '2025-11-01', DATE '2025-11-30', 'pending',
  (SELECT id FROM users WHERE username='admin'),
  (SELECT id FROM users WHERE username='admin')
);

-- ลบ (soft delete) รอบที่ pending (ทำได้)
UPDATE bonus_cycle
SET deleted_at = now(), deleted_by = (SELECT id FROM users WHERE username='admin')
WHERE status='pending' AND deleted_at IS NULL
ORDER BY id DESC
LIMIT 1;

-- ลองลบรอบที่ approved -> ควร ERROR (guard)
UPDATE bonus_cycle
SET deleted_at = now(), deleted_by = (SELECT id FROM users WHERE username='admin')
WHERE status='approved'
ORDER BY id DESC
LIMIT 1;
