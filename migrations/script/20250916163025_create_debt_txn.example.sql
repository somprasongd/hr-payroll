-- เคส A: กู้ยืม (parent) + ผ่อนชำระ (ลูก) → ลบ parent แล้ว cascade ลบลูกที่ยัง pending
-- A1) สร้าง “กู้ยืม” (parent = pending)
INSERT INTO debt_txn (employee_id, txn_date, txn_type, amount, status, reason,
                      created_by, updated_by)
VALUES (
  (SELECT id FROM employees WHERE employee_number='EMP-002'),
  DATE '2025-09-10',
  'loan',
  10000.00,
  'pending',
  'กู้ซื้ออุปกรณ์ทำงาน',
  (SELECT id FROM users WHERE username='admin'),
  (SELECT id FROM users WHERE username='admin')
)
RETURNING id AS loan_id;

-- A2) สร้าง “ผ่อนชำระ” 2 งวด (ควร ถูกบังคับ ให้เป็น status='pending' เสมอ)
-- งวด ต.ค. 2025
INSERT INTO debt_txn (employee_id, txn_date, txn_type, amount, payroll_month_date,
                      parent_id, status, created_by, updated_by)
SELECT e.id, DATE '2025-09-10', 'installment', 3000.00, DATE '2025-10-01',
      (SELECT id from debt_txn where employee_id = (SELECT id FROM employees WHERE employee_number='EMP-002') and status = 'pending' limit 1), 'approved',  -- ใส่ 'approved' มาลอง แต่ trigger จะบังคับเป็น 'pending'
      u.id, u.id
FROM employees e, users u
WHERE e.employee_number='EMP-002' AND u.username='admin';

-- งวด พ.ย. 2025
INSERT INTO debt_txn (employee_id, txn_date, txn_type, amount, payroll_month_date,
                      parent_id, created_by, updated_by)
SELECT e.id, DATE '2025-09-10', 'installment', 7000.00, DATE '2025-11-01',
      (SELECT id from debt_txn where employee_id = (SELECT id FROM employees WHERE employee_number='EMP-002') and status = 'pending' limit 1),
      u.id, u.id
FROM employees e, users u
WHERE e.employee_number='EMP-002' AND u.username='admin';

-- ตรวจดูสถานะลูก (ควรเป็น pending ทั้งคู่)
SELECT id, txn_type, payroll_month_date, status, deleted_at
FROM debt_txn
WHERE parent_id = (SELECT id from debt_txn where employee_id = (SELECT id FROM employees WHERE employee_number='EMP-002') and status = 'pending' limit 1)
ORDER BY payroll_month_date;

-- A3) แก้ไขงวดผ่อน (อนุญาต เพราะ parent ยัง pending)
UPDATE debt_txn
SET amount = 3500.00,
    updated_by = (SELECT id FROM users WHERE username='admin')
WHERE parent_id = (SELECT id from debt_txn where employee_id = (SELECT id FROM employees WHERE employee_number='EMP-002') and status = 'pending' limit 1)
  AND txn_type = 'installment'
  AND payroll_month_date = DATE '2025-10-01';

-- A4) ลอง soft delete parent → ควร “ลบลูกที่ยัง pending” ให้เอง (cascade)
UPDATE debt_txn
SET deleted_at = now(),
    deleted_by = (SELECT id FROM users WHERE username='admin'),
    updated_by = (SELECT id FROM users WHERE username='admin')
WHERE id = (SELECT id from debt_txn where employee_id = (SELECT id FROM employees WHERE employee_number='EMP-002') and status = 'pending' limit 1)
  AND status='pending'
  AND deleted_at IS NULL;

-- ตรวจผล: ลูกควรถูก soft delete ตาม (เฉพาะที่ยัง pending)
SELECT id, txn_type, payroll_month_date, status, deleted_at
FROM debt_txn
WHERE parent_id = (SELECT id from debt_txn where employee_id = (SELECT id FROM employees WHERE employee_number='EMP-002') and status = 'pending' and deleted_at is not null limit 1)
ORDER BY payroll_month_date;

-- เคส B: ห้าม soft delete parent ถ้ามีลูกที่ไม่ใช่ pending
-- B1) สร้าง parent ใหม่ + ลูก 2 งวด
-- parent (other) ต้องกรอก other_desc
INSERT INTO debt_txn (employee_id, txn_date, txn_type, other_desc, amount, status,
                      created_by, updated_by)
VALUES (
  (SELECT id FROM employees WHERE employee_number='EMP-002'),
  DATE '2025-09-15',
  'other',
  'เบิกล่วงหน้าแบบผ่อน',
  9000.00,
  'pending',
  (SELECT id FROM users WHERE username='admin'),
  (SELECT id FROM users WHERE username='admin')
)
RETURNING id AS other_id;

-- ลูกงวด 2 งวด
INSERT INTO debt_txn (employee_id, txn_date, txn_type, amount, payroll_month_date,
                      parent_id, created_by, updated_by)
SELECT e.id, DATE '2025-09-15', 'installment', 4500.00, DATE '2025-10-01',
      (SELECT id from debt_txn where employee_id = (SELECT id FROM employees WHERE employee_number='EMP-002') and status = 'pending' and deleted_at is null limit 1), u.id, u.id
FROM employees e, users u
WHERE e.employee_number='EMP-002' AND u.username='admin';

INSERT INTO debt_txn (employee_id, txn_date, txn_type, amount, payroll_month_date,
                      parent_id, created_by, updated_by)
SELECT e.id, DATE '2025-09-15', 'installment', 4500.00, DATE '2025-11-01',
      (SELECT id from debt_txn where employee_id = (SELECT id FROM employees WHERE employee_number='EMP-002') and status = 'pending' and deleted_at is null limit 1), u.id, u.id
FROM employees e, users u
WHERE e.employee_number='EMP-002' AND u.username='admin';

-- B2) อนุมัติงวดลูก 1 งวด แล้วลองลบ parent → ควร ERROR Cannot soft-delete parent while some child installments are not pending
-- อนุมัติ งวด ต.ค. 2025
UPDATE debt_txn
SET status='approved', updated_by=(SELECT id FROM users WHERE username='admin')
WHERE parent_id = (SELECT id from debt_txn where employee_id = (SELECT id FROM employees WHERE employee_number='EMP-002') and status = 'pending' and deleted_at is null limit 1)
  AND txn_type='installment'
  AND payroll_month_date = DATE '2025-10-01'
  AND deleted_at IS NULL;

-- พยายามลบ parent -> ควร RAISE EXCEPTION (มีลูกที่ไม่ใช่ pending)
UPDATE debt_txn
SET deleted_at = now(),
    deleted_by = (SELECT id FROM users WHERE username='admin'),
    updated_by = (SELECT id FROM users WHERE username='admin')
WHERE id = (SELECT id from debt_txn where employee_id = (SELECT id FROM employees WHERE employee_number='EMP-002') and status = 'pending' and deleted_at is null limit 1)
  AND status='pending'
  AND deleted_at IS NULL;

-- เคส C: อนุมัติ parent แล้ว → ห้ามแก้/ลบ parent และลูกทั้งหมด (แม้ลูกยัง pending)
-- อนุมัติ parent
UPDATE debt_txn
SET status='approved', updated_by=(SELECT id FROM users WHERE username='admin')
WHERE id = (SELECT id from debt_txn where employee_id = (SELECT id FROM employees WHERE employee_number='EMP-002') and status = 'pending' and deleted_at is null limit 1);

-- ลองแก้ลูก (ยัง pending) -> ควร ERROR (parent ไม่ pending แล้ว)
UPDATE debt_txn
SET amount = 4000.00, updated_by=(SELECT id FROM users WHERE username='admin')
WHERE parent_id = (SELECT id from debt_txn where employee_id = (SELECT id FROM employees WHERE employee_number='EMP-002') and status = 'approved' and deleted_at is null order by id limit 1)
  AND txn_type='installment'
  AND payroll_month_date = DATE '2025-11-01';

-- ลองลบลูก -> ควร ERROR เช่นกัน
UPDATE debt_txn
SET deleted_at = now(), deleted_by=(SELECT id FROM users WHERE username='admin')
WHERE parent_id = (SELECT id from debt_txn where employee_id = (SELECT id FROM employees WHERE employee_number='EMP-002') and status = 'approved' and deleted_at is null order by id limit 1)
  AND txn_type='installment'
  AND payroll_month_date = DATE '2025-11-01';

-- เคส D: “ชำระคืน” (repayment) — ไม่ต้องมี parent/payroll_month_date
-- สร้าง repayment (เพื่อลดยอดรวม) — อนุญาตให้ลบได้เมื่อยัง pending
INSERT INTO debt_txn (employee_id, txn_date, txn_type, amount, status,
                      created_by, updated_by, reason)
VALUES (
  (SELECT id FROM employees WHERE employee_number='EMP-002'),
  DATE '2025-09-20',
  'repayment',
  2000.00,
  'pending',
  (SELECT id FROM users WHERE username='admin'),
  (SELECT id FROM users WHERE username='admin'),
  'คืนเงินสด'
)
RETURNING id AS repay_id;

-- ลองใส่ parent_id ให้ repayment -> ควร ERROR (guard)
-- INSERT INTO debt_txn (... txn_type='repayment', parent_id=...) VALUES (...);

-- ลองลบ repayment (pending) -> ทำได้
UPDATE debt_txn
SET deleted_at = now(), deleted_by=(SELECT id FROM users WHERE username='admin')
WHERE id = (SELECT id from debt_txn where employee_id = (SELECT id FROM employees WHERE employee_number='EMP-002') and status = 'pending' and txn_type = 'repayment' and deleted_at is null order by id limit 1) 
AND status='pending';

-- สร้าง repayment อีกอันแล้วอนุมัติ จากนั้นลองลบ -> ควร ERROR
INSERT INTO debt_txn (employee_id, txn_date, txn_type, amount, status,
                      created_by, updated_by)
SELECT e.id, DATE '2025-09-21', 'repayment', 1500.00, 'pending', u.id, u.id
FROM employees e, users u
WHERE e.employee_number='EMP-002' AND u.username='admin'
RETURNING id AS repay2_id;

UPDATE debt_txn SET status='approved',
                    updated_by=(SELECT id FROM users WHERE username='admin')
WHERE id = (SELECT id from debt_txn where employee_id = (SELECT id FROM employees WHERE employee_number='EMP-002') and status = 'pending' and txn_type = 'repayment' and deleted_at is null order by id limit 1);

-- ลองลบ -> ควร ERROR (approved ห้ามแก้/ลบ)
UPDATE debt_txn
SET deleted_at = now(), deleted_by=(SELECT id FROM users WHERE username='admin')
WHERE id = (SELECT id from debt_txn where employee_id = (SELECT id FROM employees WHERE employee_number='EMP-002') and status = 'approved' and txn_type = 'repayment' and deleted_at is null order by id limit 1);

-- เคส E: ทดสอบข้อกำหนดข้อมูลไม่ถูกต้อง (ควร ERROR)
-- E1) installment ต้องเป็นวันแรกของเดือน
INSERT INTO debt_txn (employee_id, txn_date, txn_type, amount, payroll_month_date,
                      parent_id, created_by, updated_by)
SELECT e.id, DATE '2025-09-22', 'installment', 1000.00, DATE '2025-10-15',
      (SELECT id from debt_txn where employee_id = (SELECT id FROM employees WHERE employee_number='EMP-002') and status = 'approved' and txn_type = 'other' and deleted_at is null limit 1)
      , u.id, u.id
FROM employees e, users u
WHERE e.employee_number='EMP-002' AND u.username='admin';
-- คาดหวัง: ERROR จาก CHECK payroll_month_date

-- E2) installment ต้องมี parent
INSERT INTO debt_txn (employee_id, txn_date, txn_type, amount, payroll_month_date,
                      created_by, updated_by)
SELECT e.id, DATE '2025-09-22', 'installment', 1000.00, DATE '2025-12-01',
      u.id, u.id
FROM employees e, users u
WHERE e.employee_number='EMP-002' AND u.username='admin';
-- คาดหวัง: ERROR จาก guard 'installment must have parent_id'

-- E3) other ต้องมี other_desc
INSERT INTO debt_txn (employee_id, txn_date, txn_type, amount, status,
                      created_by, updated_by)
SELECT e.id, DATE '2025-09-22', 'other', 500.00, 'pending', u.id, u.id
FROM employees e, users u
WHERE e.employee_number='EMP-002' AND u.username='admin';
-- คาดหวัง: ERROR จาก CHECK other_desc
