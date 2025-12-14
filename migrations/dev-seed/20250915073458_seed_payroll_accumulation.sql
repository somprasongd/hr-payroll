-- Dev seed: payroll accumulation snapshots matching seeded employees
BEGIN;

WITH admin_user AS (
  SELECT id AS admin_id
  FROM users
  WHERE user_role = 'admin' AND deleted_at IS NULL
  ORDER BY created_at
  LIMIT 1
)
INSERT INTO payroll_accumulation (employee_id, accum_type, accum_year, amount, updated_by)
VALUES
  -- Full-time
  ((SELECT id FROM employees WHERE employee_number='FT-001'), 'sso', 2025, 4500.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-001'), 'sso_employer', 2025, 4500.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-001'), 'pf', NULL, 3000.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-001'), 'pf_employer', NULL, 3000.00, (SELECT admin_id FROM admin_user)),

  ((SELECT id FROM employees WHERE employee_number='FT-002'), 'sso', 2025, 3800.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-002'), 'sso_employer', 2025, 3800.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-002'), 'income', 2025, 300000.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-002'), 'pf', NULL, 2000.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-002'), 'pf_employer', NULL, 2000.00, (SELECT admin_id FROM admin_user)),

  ((SELECT id FROM employees WHERE employee_number='FT-004'), 'sso', 2025, 5200.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-004'), 'sso_employer', 2025, 5200.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-004'), 'income', 2025, 420000.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-004'), 'pf', NULL, 3500.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-004'), 'pf_employer', NULL, 3500.00, (SELECT admin_id FROM admin_user)),

  ((SELECT id FROM employees WHERE employee_number='FT-005'), 'sso', 2025, 2600.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-005'), 'sso_employer', 2025, 2600.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-005'), 'income', 2025, 240000.00, (SELECT admin_id FROM admin_user)),

  ((SELECT id FROM employees WHERE employee_number='FT-006'), 'income', 2025, 180000.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-006'), 'pf', NULL, 1200.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-006'), 'pf_employer', NULL, 1200.00, (SELECT admin_id FROM admin_user)),

  ((SELECT id FROM employees WHERE employee_number='FT-007'), 'sso', 2025, 4000.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-007'), 'sso_employer', 2025, 4000.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-007'), 'income', 2025, 350000.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-007'), 'pf', NULL, 2200.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-007'), 'pf_employer', NULL, 2200.00, (SELECT admin_id FROM admin_user)),

  ((SELECT id FROM employees WHERE employee_number='FT-008'), 'sso', 2025, 3000.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-008'), 'sso_employer', 2025, 3000.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-008'), 'income', 2025, 260000.00, (SELECT admin_id FROM admin_user)),

  ((SELECT id FROM employees WHERE employee_number='FT-009'), 'sso', 2025, 4800.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-009'), 'sso_employer', 2025, 4800.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-009'), 'income', 2025, 400000.00, (SELECT admin_id FROM admin_user)),

  ((SELECT id FROM employees WHERE employee_number='FT-010'), 'sso', 2025, 3200.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-010'), 'sso_employer', 2025, 3200.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-010'), 'income', 2025, 280000.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-010'), 'pf', NULL, 1800.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='FT-010'), 'pf_employer', NULL, 1800.00, (SELECT admin_id FROM admin_user)),

  -- Part-time
  ((SELECT id FROM employees WHERE employee_number='PT-202'), 'sso', 2025, 900.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='PT-202'), 'sso_employer', 2025, 900.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='PT-202'), 'income', 2025, 90000.00, (SELECT admin_id FROM admin_user)),

  ((SELECT id FROM employees WHERE employee_number='PT-204'), 'sso', 2025, 700.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='PT-204'), 'sso_employer', 2025, 700.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='PT-204'), 'income', 2025, 110000.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='PT-204'), 'pf', NULL, 500.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='PT-204'), 'pf_employer', NULL, 500.00, (SELECT admin_id FROM admin_user)),

  ((SELECT id FROM employees WHERE employee_number='PT-205'), 'income', 2025, 95000.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='PT-205'), 'pf', NULL, 600.00, (SELECT admin_id FROM admin_user)),
  ((SELECT id FROM employees WHERE employee_number='PT-205'), 'pf_employer', NULL, 600.00, (SELECT admin_id FROM admin_user));

COMMIT;
