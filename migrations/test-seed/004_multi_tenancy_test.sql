-- Seed test data for Multi-tenancy tests
-- Creates:
-- 1. COMPANY2 with admin2 user
-- 2. Branches for COMPANY2 (HQ + สาขา 1)
-- 3. Departments, Positions
-- 4. Employees for COMPANY2 (C2-FT-001, C2-FT-101, etc.)
-- 
-- Used by tests:
-- - 19-multi-tenancy.spec.ts

BEGIN;

DO $$
DECLARE
  v_superadmin_id UUID;
  v_admin2_id UUID;
  v_company2_id UUID;
  v_branch2_hq_id UUID;
  v_branch2_second_id UUID;
  v_current_month_start DATE;
  
  -- Ref data
  v_mr_id UUID;
  v_ms_id UUID;
  v_th_cid_id UUID;
  v_ft_id UUID;
  v_pt_id UUID;
  
  -- Dept/Position for COMPANY2
  v_dept_production UUID;
  v_dept_warehouse UUID;
  v_pos_supervisor UUID;
  v_pos_helper UUID;
BEGIN
  -- Get superadmin or admin as creator
  SELECT id INTO v_superadmin_id FROM users WHERE username = 'superadmin' AND deleted_at IS NULL LIMIT 1;
  IF v_superadmin_id IS NULL THEN
    SELECT id INTO v_superadmin_id FROM users WHERE username = 'admin' AND deleted_at IS NULL LIMIT 1;
  END IF;
  
  v_current_month_start := date_trunc('month', CURRENT_DATE)::date;
  
  -- Get reference data
  SELECT id INTO v_mr_id FROM person_title WHERE code = 'mr' LIMIT 1;
  SELECT id INTO v_ms_id FROM person_title WHERE code = 'ms' LIMIT 1;
  SELECT id INTO v_th_cid_id FROM id_document_type WHERE code = 'th_cid' LIMIT 1;
  SELECT id INTO v_ft_id FROM employee_type WHERE code = 'full_time' LIMIT 1;
  SELECT id INTO v_pt_id FROM employee_type WHERE code = 'part_time' LIMIT 1;
  
  -- ====== 1. Create COMPANY2 ======
  IF NOT EXISTS (SELECT 1 FROM companies WHERE code = 'COMPANY2') THEN
    INSERT INTO companies (code, name, status, created_by, updated_by)
    VALUES ('COMPANY2', 'บริษัท ทดสอบ 2 จำกัด', 'active', v_superadmin_id, v_superadmin_id)
    RETURNING id INTO v_company2_id;
  ELSE
    SELECT id INTO v_company2_id FROM companies WHERE code = 'COMPANY2' LIMIT 1;
  END IF;
  
  -- ====== 2. Create admin2 user ======
  IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin2' AND deleted_at IS NULL) THEN
    INSERT INTO users (username, password_hash, user_role, created_by, updated_by)
    VALUES (
      'admin2',
      '$argon2id$v=19$m=65536,t=3,p=4$vdCnms0qqpwQwsGkU9tONQ$/wvzZ56+cOqNU2AUQzQxmKAr0x+JrFCL7Qa1YeQxvpg', -- 'changeme'
      'admin',
      v_superadmin_id,
      v_superadmin_id
    )
    RETURNING id INTO v_admin2_id;
  ELSE
    SELECT id INTO v_admin2_id FROM users WHERE username = 'admin2' AND deleted_at IS NULL LIMIT 1;
  END IF;
  
  -- Assign admin2 to COMPANY2
  INSERT INTO user_company_roles (user_id, company_id, role, created_by)
  VALUES (v_admin2_id, v_company2_id, 'admin', v_superadmin_id)
  ON CONFLICT (user_id, company_id) DO NOTHING;
  
  -- ====== 3. Organization Profile and Config for COMPANY2 ======
  IF NOT EXISTS (SELECT 1 FROM payroll_org_profile WHERE company_id = v_company2_id) THEN
    INSERT INTO payroll_org_profile (
      company_id, effective_daterange,
      company_name, status, created_by, updated_by
    ) VALUES (
      v_company2_id, daterange(v_current_month_start, NULL, '[)'),
      'บริษัท ทดสอบ 2 จำกัด', 'active', v_admin2_id, v_admin2_id
    );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM payroll_config WHERE company_id = v_company2_id) THEN
    INSERT INTO payroll_config (
      company_id, effective_daterange,
      hourly_rate, ot_hourly_rate,
      attendance_bonus_no_late, attendance_bonus_no_leave,
      housing_allowance, water_rate_per_unit, electricity_rate_per_unit,
      internet_fee_monthly,
      social_security_rate_employee, social_security_rate_employer, social_security_wage_cap,
      tax_apply_standard_expense, tax_standard_expense_rate, tax_standard_expense_cap,
      tax_apply_personal_allowance, tax_personal_allowance_amount, tax_progressive_brackets,
      withholding_tax_rate_service,
      status, created_by, updated_by
    ) VALUES (
      v_company2_id, daterange(v_current_month_start, NULL, '[)'),
      80.00, 80.00,
      600.00, 1200.00,
      1500.00, 12.00, 7.00, 100.00,
      0.05, 0.05, 17500.00,
      TRUE, 0.50, 100000.00,
      TRUE, 60000.00, '[{"min":0,"max":150000,"rate":0},{"min":150001,"max":300000,"rate":0.05},{"min":300001,"max":500000,"rate":0.10},{"min":500001,"max":750000,"rate":0.15},{"min":750001,"max":1000000,"rate":0.20},{"min":1000001,"max":2000000,"rate":0.25},{"min":2000001,"max":5000000,"rate":0.30},{"min":5000001,"max":null,"rate":0.35}]'::jsonb,
      0.03,
      'active', v_admin2_id, v_admin2_id
    );
  END IF;
  
  -- ====== 4. Create branches for COMPANY2 ======
  IF NOT EXISTS (
    SELECT 1 FROM branches 
    WHERE company_id = v_company2_id AND code = '00000' AND deleted_at IS NULL
  ) THEN
    INSERT INTO branches (company_id, code, name, status, is_default, created_by, updated_by)
    VALUES (v_company2_id, '00000', 'สำนักงานใหญ่', 'active', TRUE, v_admin2_id, v_admin2_id)
    RETURNING id INTO v_branch2_hq_id;
  ELSE
    SELECT id INTO v_branch2_hq_id FROM branches 
      WHERE company_id = v_company2_id AND code = '00000' AND deleted_at IS NULL LIMIT 1;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM branches 
    WHERE company_id = v_company2_id AND code = '00001' AND deleted_at IS NULL
  ) THEN
    INSERT INTO branches (company_id, code, name, status, is_default, created_by, updated_by)
    VALUES (v_company2_id, '00001', 'สาขา 1', 'active', FALSE, v_admin2_id, v_admin2_id)
    RETURNING id INTO v_branch2_second_id;
  ELSE
    SELECT id INTO v_branch2_second_id FROM branches 
      WHERE company_id = v_company2_id AND code = '00001' AND deleted_at IS NULL LIMIT 1;
  END IF;
  
  -- Grant admin2 access to both branches
  INSERT INTO user_branch_access (user_id, branch_id, created_by)
  VALUES 
    (v_admin2_id, v_branch2_hq_id, v_superadmin_id),
    (v_admin2_id, v_branch2_second_id, v_superadmin_id)
  ON CONFLICT DO NOTHING;
  
  -- ====== 5. Create Departments for COMPANY2 ======
  INSERT INTO department (code, name_th, company_id, created_by, updated_by) VALUES
    ('production', 'ฝ่ายผลิต', v_company2_id, v_admin2_id, v_admin2_id),
    ('warehouse', 'คลังสินค้า', v_company2_id, v_admin2_id, v_admin2_id)
  ON CONFLICT DO NOTHING;
  
  SELECT id INTO v_dept_production FROM department 
    WHERE code = 'production' AND company_id = v_company2_id AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_dept_warehouse FROM department 
    WHERE code = 'warehouse' AND company_id = v_company2_id AND deleted_at IS NULL LIMIT 1;
  
  -- ====== 6. Create Positions for COMPANY2 ======
  INSERT INTO employee_position (code, name_th, company_id, created_by, updated_by) VALUES
    ('supervisor', 'หัวหน้างาน', v_company2_id, v_admin2_id, v_admin2_id),
    ('helper', 'ผู้ช่วย', v_company2_id, v_admin2_id, v_admin2_id)
  ON CONFLICT DO NOTHING;
  
  SELECT id INTO v_pos_supervisor FROM employee_position 
    WHERE code = 'supervisor' AND company_id = v_company2_id AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_pos_helper FROM employee_position 
    WHERE code = 'helper' AND company_id = v_company2_id AND deleted_at IS NULL LIMIT 1;
  
  -- ====== 7. Create Employees for COMPANY2 (using IF NOT EXISTS) ======
  -- C2-FT-001: HQ Full-time
  IF NOT EXISTS (
    SELECT 1 FROM employees 
    WHERE company_id = v_company2_id AND lower(employee_number) = 'c2-ft-001' 
      AND employment_end_date IS NULL AND deleted_at IS NULL
  ) THEN
    INSERT INTO employees (
      employee_number, title_id, first_name, last_name,
      id_document_type_id, id_document_number, phone, email,
      employee_type_id, department_id, position_id, company_id, branch_id,
      base_pay_amount, employment_start_date,
      bank_name, bank_account_no,
      sso_contribute, sso_declared_wage,
      provident_fund_contribute, provident_fund_rate_employee, provident_fund_rate_employer,
      withhold_tax, allow_housing, allow_water, allow_electric, allow_internet, allow_doctor_fee,
      allow_attendance_bonus_nolate, allow_attendance_bonus_noleave,
      created_by, updated_by
    ) VALUES (
      'C2-FT-001', v_mr_id, 'Itsara', 'Jongjit', v_th_cid_id, '1200000000011', '0830000001', 'itsara@company2.com',
      v_ft_id, v_dept_production, v_pos_supervisor, v_company2_id, v_branch2_hq_id,
      38000.00, DATE '2024-01-05', 'KBank', '789-1-00001-7',
      TRUE, 15000.00, TRUE, 0.05, 0.05, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE,
      v_admin2_id, v_admin2_id
    );
  END IF;
  
  -- C2-PT-001: HQ Part-time
  IF NOT EXISTS (
    SELECT 1 FROM employees 
    WHERE company_id = v_company2_id AND lower(employee_number) = 'c2-pt-001' 
      AND employment_end_date IS NULL AND deleted_at IS NULL
  ) THEN
    INSERT INTO employees (
      employee_number, title_id, first_name, last_name,
      id_document_type_id, id_document_number, phone, email,
      employee_type_id, department_id, position_id, company_id, branch_id,
      base_pay_amount, employment_start_date,
      bank_name, bank_account_no,
      sso_contribute, sso_declared_wage,
      provident_fund_contribute, provident_fund_rate_employee, provident_fund_rate_employer,
      withhold_tax, allow_housing, allow_water, allow_electric, allow_internet, allow_doctor_fee,
      allow_attendance_bonus_nolate, allow_attendance_bonus_noleave,
      created_by, updated_by
    ) VALUES (
      'C2-PT-001', v_mr_id, 'Lertchai', 'Manee', v_th_cid_id, '1200000000111', '0840000001', 'lertchai@company2.com',
      v_pt_id, v_dept_warehouse, v_pos_helper, v_company2_id, v_branch2_hq_id,
      100.00, DATE '2024-04-01', 'KBank', '789-4-10000-1',
      TRUE, 6000.00, FALSE, 0.00, 0.00, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE,
      v_admin2_id, v_admin2_id
    );
  END IF;
  
  -- C2-FT-101: Branch 1 Full-time
  IF NOT EXISTS (
    SELECT 1 FROM employees 
    WHERE company_id = v_company2_id AND lower(employee_number) = 'c2-ft-101' 
      AND employment_end_date IS NULL AND deleted_at IS NULL
  ) THEN
    INSERT INTO employees (
      employee_number, title_id, first_name, last_name,
      id_document_type_id, id_document_number, phone, email,
      employee_type_id, department_id, position_id, company_id, branch_id,
      base_pay_amount, employment_start_date,
      bank_name, bank_account_no,
      sso_contribute, sso_declared_wage,
      provident_fund_contribute, provident_fund_rate_employee, provident_fund_rate_employer,
      withhold_tax, allow_housing, allow_water, allow_electric, allow_internet, allow_doctor_fee,
      allow_attendance_bonus_nolate, allow_attendance_bonus_noleave,
      created_by, updated_by
    ) VALUES (
      'C2-FT-101', v_mr_id, 'Noppadon', 'Orachai', v_th_cid_id, '1200000000045', '0830000101', 'noppadon@company2.com',
      v_ft_id, v_dept_production, v_pos_supervisor, v_company2_id, v_branch2_second_id,
      33000.00, DATE '2024-01-15', 'Krungsri', '890-1-00101-1',
      TRUE, 15000.00, TRUE, 0.04, 0.04, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE, TRUE,
      v_admin2_id, v_admin2_id
    );
  END IF;
  
  -- C2-PT-101: Branch 1 Part-time
  IF NOT EXISTS (
    SELECT 1 FROM employees 
    WHERE company_id = v_company2_id AND lower(employee_number) = 'c2-pt-101' 
      AND employment_end_date IS NULL AND deleted_at IS NULL
  ) THEN
    INSERT INTO employees (
      employee_number, title_id, first_name, last_name,
      id_document_type_id, id_document_number, phone, email,
      employee_type_id, department_id, position_id, company_id, branch_id,
      base_pay_amount, employment_start_date,
      bank_name, bank_account_no,
      sso_contribute, sso_declared_wage,
      provident_fund_contribute, provident_fund_rate_employee, provident_fund_rate_employer,
      withhold_tax, allow_housing, allow_water, allow_electric, allow_internet, allow_doctor_fee,
      allow_attendance_bonus_nolate, allow_attendance_bonus_noleave,
      created_by, updated_by
    ) VALUES (
      'C2-PT-101', v_mr_id, 'Rattana', 'Somboon', v_th_cid_id, '1200000000137', '0840000101', 'rattana@company2.com',
      v_pt_id, v_dept_warehouse, v_pos_helper, v_company2_id, v_branch2_second_id,
      95.00, DATE '2024-05-01', 'KBank', '890-4-10101-4',
      TRUE, 5000.00, FALSE, 0.00, 0.00, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE,
      v_admin2_id, v_admin2_id
    );
  END IF;

  RAISE NOTICE 'Created COMPANY2 with admin2 user, 2 branches, and 4 employees';
END $$;

COMMIT;
