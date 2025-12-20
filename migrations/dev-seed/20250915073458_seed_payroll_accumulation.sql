-- Dev seed: payroll accumulation snapshots matching seeded employees
BEGIN;

WITH admin_user AS (
  SELECT id AS admin_id
  FROM users
  WHERE user_role = 'admin' AND deleted_at IS NULL
  ORDER BY created_at
  LIMIT 1
),
default_tenant AS (
  SELECT id AS company_id
  FROM companies
  WHERE code = 'DEFAULT'
  LIMIT 1
)
INSERT INTO payroll_accumulation (employee_id, company_id, accum_type, accum_year, amount, updated_by)
VALUES
  -- Full-time
  ((SELECT id FROM employees WHERE employee_number='FT-001' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'sso', 2025, 4500.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-001' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'sso_employer', 2025, 4500.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-001' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'pf', NULL, 3000.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-001' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'pf_employer', NULL, 3000.00, (SELECT admin_id FROM admin_user)),

  ((SELECT id FROM employees WHERE employee_number='FT-002' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'sso', 2025, 3800.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-002' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'sso_employer', 2025, 3800.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-002' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'income', 2025, 300000.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-002' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'pf', NULL, 2000.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-002' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'pf_employer', NULL, 2000.00, (SELECT admin_id FROM admin_user)),

  ((SELECT id FROM employees WHERE employee_number='FT-004' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'sso', 2025, 5200.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-004' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'sso_employer', 2025, 5200.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-004' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'income', 2025, 420000.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-004' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'pf', NULL, 3500.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-004' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'pf_employer', NULL, 3500.00, (SELECT admin_id FROM admin_user)),

  ((SELECT id FROM employees WHERE employee_number='FT-005' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'sso', 2025, 2600.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-005' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'sso_employer', 2025, 2600.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-005' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'income', 2025, 240000.00, (SELECT admin_id FROM admin_user)),

  ((SELECT id FROM employees WHERE employee_number='FT-006' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'income', 2025, 180000.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-006' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'pf', NULL, 1200.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-006' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'pf_employer', NULL, 1200.00, (SELECT admin_id FROM admin_user)),

  ((SELECT id FROM employees WHERE employee_number='FT-007' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'sso', 2025, 4000.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-007' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'sso_employer', 2025, 4000.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-007' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'income', 2025, 350000.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-007' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'pf', NULL, 2200.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-007' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'pf_employer', NULL, 2200.00, (SELECT admin_id FROM admin_user)),

  ((SELECT id FROM employees WHERE employee_number='FT-008' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'sso', 2025, 3000.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-008' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'sso_employer', 2025, 3000.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-008' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'income', 2025, 260000.00, (SELECT admin_id FROM admin_user)),

  ((SELECT id FROM employees WHERE employee_number='FT-009' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'sso', 2025, 4800.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-009' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'sso_employer', 2025, 4800.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-009' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'income', 2025, 400000.00, (SELECT admin_id FROM admin_user)),

  ((SELECT id FROM employees WHERE employee_number='FT-010' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'sso', 2025, 3200.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-010' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'sso_employer', 2025, 3200.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-010' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'income', 2025, 280000.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-010' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'pf', NULL, 1800.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-010' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'pf_employer', NULL, 1800.00, (SELECT admin_id FROM admin_user)),

  -- Part-time
  ((SELECT id FROM employees WHERE employee_number='PT-202' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'sso', 2025, 900.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='PT-202' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'sso_employer', 2025, 900.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='PT-202' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'income', 2025, 90000.00, (SELECT admin_id FROM admin_user)),

  ((SELECT id FROM employees WHERE employee_number='PT-204' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'sso', 2025, 700.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='PT-204' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'sso_employer', 2025, 700.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='PT-204' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'income', 2025, 110000.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='PT-204' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'pf', NULL, 500.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='PT-204' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'pf_employer', NULL, 500.00, (SELECT admin_id FROM admin_user)),

  ((SELECT id FROM employees WHERE employee_number='PT-205' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'income', 2025, 95000.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='PT-205' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'pf', NULL, 600.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='PT-205' AND company_id = (SELECT company_id FROM default_tenant) LIMIT 1), (SELECT company_id FROM default_tenant), 'pf_employer', NULL, 600.00, (SELECT admin_id FROM admin_user));

COMMIT;
