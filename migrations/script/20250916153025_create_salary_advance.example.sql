-- เพิ่มคำขอเบิกล่วงหน้า
INSERT INTO salary_advance (employee_id, payroll_month_date, advance_date, amount, created_by, updated_by)
VALUES (
  (SELECT id FROM employees WHERE employee_number='EMP-001'),
  DATE '2025-09-01',
  DATE '2025-09-12',
  5000.00,
  (SELECT id FROM users WHERE username='admin'),
  (SELECT id FROM users WHERE username='admin')
);

-- ค้นหา: ตามวันที่เบิก + สถานะ
SELECT * FROM salary_advance
WHERE advance_date BETWEEN DATE '2025-09-01' AND DATE '2025-09-30'
  AND status='pending'
  AND deleted_at IS NULL;

-- ทำเครื่องหมายว่า “คำนวนเงินแล้ว” (ตอนตัดเงินเดือนงวดนั้นเสร็จ)
UPDATE salary_advance
SET status='processed', updated_by=(SELECT id FROM users WHERE username='admin')
WHERE employee_id = (SELECT id FROM employees WHERE employee_number='EMP-001')
  AND payroll_month_date = DATE '2025-09-01'
  AND status='pending';

-- ลบแบบ soft (ทำได้เฉพาะ pending)
UPDATE salary_advance
SET deleted_at=now(), deleted_by=(SELECT id FROM users WHERE username='admin')
WHERE status='pending';
