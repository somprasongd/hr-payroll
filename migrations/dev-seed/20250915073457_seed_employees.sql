-- Dev seed: sample employees (10 Full-time, 5 Part-time) with varied benefit settings
BEGIN;

WITH admin_user AS (
  SELECT id AS admin_id
  FROM users
  WHERE user_role = 'admin' AND deleted_at IS NULL
  ORDER BY created_at
  LIMIT 1
)
-- Seed departments (idempotent, ignores soft-deleted rows)
INSERT INTO department (code, name_th, created_by, updated_by)
VALUES
  ('hr','ฝ่ายบุคคล',(SELECT admin_id FROM admin_user),(SELECT admin_id FROM admin_user)),
  ('finance','การเงิน',(SELECT admin_id FROM admin_user),(SELECT admin_id FROM admin_user)),
  ('sales','ฝ่ายขาย',(SELECT admin_id FROM admin_user),(SELECT admin_id FROM admin_user)),
  ('it','ไอที',(SELECT admin_id FROM admin_user),(SELECT admin_id FROM admin_user)),
  ('ops','ปฏิบัติการ',(SELECT admin_id FROM admin_user),(SELECT admin_id FROM admin_user))
-- Partial unique index (active codes only) cannot be targeted directly; rely on any conflict
ON CONFLICT DO NOTHING;

-- Seed employee positions (idempotent, ignores soft-deleted rows)
WITH admin_user AS (
  SELECT id AS admin_id
  FROM users
  WHERE user_role = 'admin' AND deleted_at IS NULL
  ORDER BY created_at
  LIMIT 1
)
INSERT INTO employee_position (code, name_th, created_by, updated_by)
VALUES
  ('manager','ผู้จัดการ',(SELECT admin_id FROM admin_user),(SELECT admin_id FROM admin_user)),
  ('lead','หัวหน้าทีม',(SELECT admin_id FROM admin_user),(SELECT admin_id FROM admin_user)),
  ('analyst','นักวิเคราะห์',(SELECT admin_id FROM admin_user),(SELECT admin_id FROM admin_user)),
  ('developer','นักพัฒนา',(SELECT admin_id FROM admin_user),(SELECT admin_id FROM admin_user)),
  ('staff','พนักงาน',(SELECT admin_id FROM admin_user),(SELECT admin_id FROM admin_user))
-- Partial unique index (active codes only) cannot be targeted directly; rely on any conflict
ON CONFLICT DO NOTHING;

WITH admin_user AS (
  SELECT id AS admin_id
  FROM users
  WHERE user_role = 'admin' AND deleted_at IS NULL
  ORDER BY created_at
  LIMIT 1
)
INSERT INTO employees (
  employee_number, title_id, first_name, last_name,
  id_document_type_id, id_document_number, phone, email,
  photo_id, employee_type_id, department_id, position_id, base_pay_amount,
  employment_start_date, employment_end_date,
  bank_name, bank_account_no,
  sso_contribute, sso_declared_wage,
  provident_fund_contribute, provident_fund_rate_employee, provident_fund_rate_employer,
  withhold_tax,
  allow_housing, allow_water, allow_electric, allow_internet, allow_doctor_fee,
  created_by, updated_by
)
VALUES
-- Full-time staff
('FT-001', (SELECT id FROM person_title WHERE code='mr'), 'Arthit', 'Prasert',
 (SELECT id FROM id_document_type WHERE code='th_cid'), '1100000000011', '0810000001', 'arthit.pr@example.com',
 NULL, (SELECT id FROM employee_type WHERE code='full_time'),
 (SELECT id FROM department WHERE code='hr' AND deleted_at IS NULL LIMIT 1),
 (SELECT id FROM employee_position WHERE code='manager' AND deleted_at IS NULL LIMIT 1),
 32000.00,
 DATE '2024-01-10', NULL,
 'KBank', '123-4-00001-0',
 TRUE, 15000.00,
 TRUE, 0.05, 0.05,
 TRUE,
 TRUE, TRUE, TRUE, TRUE, TRUE,
 (SELECT admin_id FROM admin_user), (SELECT admin_id FROM admin_user)),

('FT-002', (SELECT id FROM person_title WHERE code='mrs'), 'Benjamas', 'Sooksai',
 (SELECT id FROM id_document_type WHERE code='th_cid'), '1100000000029', '0810000002', 'benjamas.s@example.com',
 NULL, (SELECT id FROM employee_type WHERE code='full_time'),
 (SELECT id FROM department WHERE code='finance' AND deleted_at IS NULL LIMIT 1),
 (SELECT id FROM employee_position WHERE code='analyst' AND deleted_at IS NULL LIMIT 1),
 28000.00,
 DATE '2024-02-15', NULL,
 'SCB', '111-2-00002-1',
 TRUE, 14000.00,
 TRUE, 0.03, 0.03,
 TRUE,
 TRUE, FALSE, TRUE, FALSE, FALSE,
 (SELECT admin_id FROM admin_user), (SELECT admin_id FROM admin_user)),

('FT-003', (SELECT id FROM person_title WHERE code='ms'), 'Chalida', 'Wongthai',
 (SELECT id FROM id_document_type WHERE code='th_cid'), '1100000000037', '0810000003', 'chalida.w@example.com',
 NULL, (SELECT id FROM employee_type WHERE code='full_time'),
 (SELECT id FROM department WHERE code='hr' AND deleted_at IS NULL LIMIT 1),
 (SELECT id FROM employee_position WHERE code='staff' AND deleted_at IS NULL LIMIT 1),
 25000.00,
 DATE '2024-03-01', NULL,
 'Bangkok Bank', '222-1-00003-2',
 FALSE, NULL,
 FALSE, 0.00, 0.00,
 FALSE,
 FALSE, TRUE, FALSE, TRUE, FALSE,
 (SELECT admin_id FROM admin_user), (SELECT admin_id FROM admin_user)),

('FT-004', (SELECT id FROM person_title WHERE code='mr'), 'Danai', 'Chanthep',
 (SELECT id FROM id_document_type WHERE code='th_cid'), '1100000000045', '0810000004', 'danai.c@example.com',
 NULL, (SELECT id FROM employee_type WHERE code='full_time'),
 (SELECT id FROM department WHERE code='sales' AND deleted_at IS NULL LIMIT 1),
 (SELECT id FROM employee_position WHERE code='lead' AND deleted_at IS NULL LIMIT 1),
 40000.00,
 DATE '2023-11-20', NULL,
 'Krungsri', '333-3-00004-3',
 TRUE, 15000.00,
 TRUE, 0.05, 0.05,
 TRUE,
 TRUE, TRUE, TRUE, FALSE, TRUE,
 (SELECT admin_id FROM admin_user), (SELECT admin_id FROM admin_user)),

('FT-005', (SELECT id FROM person_title WHERE code='ms'), 'Ekkarat', 'Thongchai',
 (SELECT id FROM id_document_type WHERE code='th_cid'), '1100000000053', '0810000005', 'ekkarat.t@example.com',
 NULL, (SELECT id FROM employee_type WHERE code='full_time'),
 (SELECT id FROM department WHERE code='sales' AND deleted_at IS NULL LIMIT 1),
 (SELECT id FROM employee_position WHERE code='staff' AND deleted_at IS NULL LIMIT 1),
 22000.00,
 DATE '2024-05-05', NULL,
 'KTB', '444-0-00005-4',
 TRUE, 18000.00,
 FALSE, 0.00, 0.00,
 FALSE,
 FALSE, FALSE, TRUE, TRUE, TRUE,
 (SELECT admin_id FROM admin_user), (SELECT admin_id FROM admin_user)),

('FT-006', (SELECT id FROM person_title WHERE code='mr'), 'Phuwanat', 'Meechai',
 (SELECT id FROM id_document_type WHERE code='th_cid'), '1100000000061', '0810000006', 'phuwanat.m@example.com',
 NULL, (SELECT id FROM employee_type WHERE code='full_time'),
 (SELECT id FROM department WHERE code='it' AND deleted_at IS NULL LIMIT 1),
 (SELECT id FROM employee_position WHERE code='developer' AND deleted_at IS NULL LIMIT 1),
 30000.00,
 DATE '2024-06-01', NULL,
 NULL, NULL,
 FALSE, NULL,
 TRUE, 0.02, 0.02,
 FALSE,
 TRUE, FALSE, FALSE, FALSE, FALSE,
 (SELECT admin_id FROM admin_user), (SELECT admin_id FROM admin_user)),

('FT-007', (SELECT id FROM person_title WHERE code='mrs'), 'Ratchanee', 'Thongyai',
 (SELECT id FROM id_document_type WHERE code='th_cid'), '1100000000079', '0810000007', 'ratchanee.t@example.com',
 NULL, (SELECT id FROM employee_type WHERE code='full_time'),
 (SELECT id FROM department WHERE code='finance' AND deleted_at IS NULL LIMIT 1),
 (SELECT id FROM employee_position WHERE code='analyst' AND deleted_at IS NULL LIMIT 1),
 27000.00,
 DATE '2024-07-10', NULL,
 'GSB', '555-5-00007-5',
 TRUE, 15000.00,
 TRUE, 0.04, 0.04,
 TRUE,
 FALSE, TRUE, TRUE, FALSE, FALSE,
 (SELECT admin_id FROM admin_user), (SELECT admin_id FROM admin_user)),

('FT-008', (SELECT id FROM person_title WHERE code='ms'), 'Siriporn', 'Jaidee',
 (SELECT id FROM id_document_type WHERE code='th_cid'), '1100000000087', '0810000008', 'siriporn.j@example.com',
 NULL, (SELECT id FROM employee_type WHERE code='full_time'),
 (SELECT id FROM department WHERE code='finance' AND deleted_at IS NULL LIMIT 1),
 (SELECT id FROM employee_position WHERE code='staff' AND deleted_at IS NULL LIMIT 1),
 26000.00,
 DATE '2024-08-05', NULL,
 'CIMB', '666-6-00008-6',
 TRUE, 15000.00,
 TRUE, 0.03, 0.03,
 FALSE,
 TRUE, FALSE, FALSE, TRUE, FALSE,
 (SELECT admin_id FROM admin_user), (SELECT admin_id FROM admin_user)),

('FT-009', (SELECT id FROM person_title WHERE code='mr'), 'Thanakorn', 'Sriwilai',
 (SELECT id FROM id_document_type WHERE code='th_cid'), '1100000000095', '0810000009', 'thanakorn.s@example.com',
 NULL, (SELECT id FROM employee_type WHERE code='full_time'),
 (SELECT id FROM department WHERE code='sales' AND deleted_at IS NULL LIMIT 1),
 (SELECT id FROM employee_position WHERE code='lead' AND deleted_at IS NULL LIMIT 1),
 35000.00,
 DATE '2023-09-15', NULL,
 'TTB', '777-7-00009-7',
 TRUE, 15000.00,
 FALSE, 0.00, 0.00,
 TRUE,
 FALSE, FALSE, FALSE, TRUE, FALSE,
 (SELECT admin_id FROM admin_user), (SELECT admin_id FROM admin_user)),

('FT-010', (SELECT id FROM person_title WHERE code='ms'), 'Wimonrat', 'Kittipong',
 (SELECT id FROM id_document_type WHERE code='th_cid'), '1100000000103', '0810000010', 'wimonrat.k@example.com',
 NULL, (SELECT id FROM employee_type WHERE code='full_time'),
 (SELECT id FROM department WHERE code='it' AND deleted_at IS NULL LIMIT 1),
 (SELECT id FROM employee_position WHERE code='developer' AND deleted_at IS NULL LIMIT 1),
 24000.00,
 DATE '2024-09-01', NULL,
 'UOB', '888-8-00010-8',
 TRUE, 20000.00,
 TRUE, 0.05, 0.05,
 FALSE,
 TRUE, TRUE, FALSE, FALSE, TRUE,
 (SELECT admin_id FROM admin_user), (SELECT admin_id FROM admin_user)),

-- Part-time staff
('PT-201', (SELECT id FROM person_title WHERE code='mr'), 'Anucha', 'Phromdee',
 (SELECT id FROM id_document_type WHERE code='th_cid'), '1100000000111', '0820000001', 'anucha.p@example.com',
 NULL, (SELECT id FROM employee_type WHERE code='part_time'),
 (SELECT id FROM department WHERE code='ops' AND deleted_at IS NULL LIMIT 1),
 (SELECT id FROM employee_position WHERE code='staff' AND deleted_at IS NULL LIMIT 1),
 120.00,
 DATE '2024-03-20', NULL,
 NULL, NULL,
 FALSE, NULL,
 FALSE, 0.00, 0.00,
 FALSE,
 FALSE, FALSE, FALSE, TRUE, FALSE,
 (SELECT admin_id FROM admin_user), (SELECT admin_id FROM admin_user)),

('PT-202', (SELECT id FROM person_title WHERE code='ms'), 'Boonyisa', 'Ritthikul',
 (SELECT id FROM id_document_type WHERE code='th_cid'), '1100000000129', '0820000002', 'boonyisa.r@example.com',
 NULL, (SELECT id FROM employee_type WHERE code='part_time'),
 (SELECT id FROM department WHERE code='ops' AND deleted_at IS NULL LIMIT 1),
 (SELECT id FROM employee_position WHERE code='staff' AND deleted_at IS NULL LIMIT 1),
 135.00,
 DATE '2024-04-01', NULL,
 'KBank', '123-4-20200-1',
 TRUE, 9000.00,
 FALSE, 0.00, 0.00,
 FALSE,
 FALSE, TRUE, FALSE, FALSE, FALSE,
 (SELECT admin_id FROM admin_user), (SELECT admin_id FROM admin_user)),

('PT-203', (SELECT id FROM person_title WHERE code='mr'), 'Chakrit', 'Meechai',
 (SELECT id FROM id_document_type WHERE code='th_cid'), '1100000000137', '0820000003', 'chakrit.m@example.com',
 NULL, (SELECT id FROM employee_type WHERE code='part_time'),
 (SELECT id FROM department WHERE code='ops' AND deleted_at IS NULL LIMIT 1),
 (SELECT id FROM employee_position WHERE code='staff' AND deleted_at IS NULL LIMIT 1),
 150.00,
 DATE '2024-05-12', NULL,
 NULL, NULL,
 FALSE, NULL,
 FALSE, 0.00, 0.00,
 TRUE,
 FALSE, FALSE, TRUE, TRUE, FALSE,
 (SELECT admin_id FROM admin_user), (SELECT admin_id FROM admin_user)),

('PT-204', (SELECT id FROM person_title WHERE code='ms'), 'Duangjai', 'Saelim',
 (SELECT id FROM id_document_type WHERE code='th_cid'), '1100000000145', '0820000004', 'duangjai.s@example.com',
 NULL, (SELECT id FROM employee_type WHERE code='part_time'),
 (SELECT id FROM department WHERE code='ops' AND deleted_at IS NULL LIMIT 1),
 (SELECT id FROM employee_position WHERE code='staff' AND deleted_at IS NULL LIMIT 1),
 110.00,
 DATE '2024-06-18', NULL,
 'SCB', '111-2-20400-2',
 TRUE, 7000.00,
 TRUE, 0.02, 0.02,
 FALSE,
 FALSE, TRUE, TRUE, FALSE, FALSE,
 (SELECT admin_id FROM admin_user), (SELECT admin_id FROM admin_user)),

('PT-205', (SELECT id FROM person_title WHERE code='mr'), 'Ekkasit', 'Yingyong',
 (SELECT id FROM id_document_type WHERE code='th_cid'), '1100000000152', '0820000005', 'ekkasit.y@example.com',
 NULL, (SELECT id FROM employee_type WHERE code='part_time'),
 (SELECT id FROM department WHERE code='ops' AND deleted_at IS NULL LIMIT 1),
 (SELECT id FROM employee_position WHERE code='staff' AND deleted_at IS NULL LIMIT 1),
 140.00,
 DATE '2024-07-25', NULL,
 NULL, NULL,
 FALSE, NULL,
 TRUE, 0.03, 0.03,
 FALSE,
 TRUE, FALSE, FALSE, TRUE, FALSE,
 (SELECT admin_id FROM admin_user), (SELECT admin_id FROM admin_user));

COMMIT;
