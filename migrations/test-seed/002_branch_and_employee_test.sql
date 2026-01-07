-- Seed test data for Branch Switching and Multi-tenancy tests
-- Creates:
-- 1. Additional branch "สาขา 1" for DEFAULT company
-- 2. Department and Position if not exists
-- 3. Employees for testing branch switching navigation
-- 
-- Used by tests:
-- - 19-multi-tenancy.spec.ts
-- - 24-branch-switch-navigation.spec.ts

BEGIN;

DO $$
DECLARE
  v_default_company_id UUID;
  v_admin_id UUID;
  v_branch1_id UUID;
  v_default_hq_id UUID;
  v_dept_id UUID;
  v_pos_id UUID;
  v_ft_id UUID;
  v_pt_id UUID;
  v_mr_id UUID;
  v_ms_id UUID;
  v_th_cid_id UUID;
BEGIN
  -- Get DEFAULT company and admin
  SELECT id INTO v_default_company_id FROM companies WHERE code = 'DEFAULT' LIMIT 1;
  SELECT id INTO v_admin_id FROM users WHERE username = 'admin' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_default_hq_id FROM branches 
    WHERE company_id = v_default_company_id AND code = '00000' AND deleted_at IS NULL LIMIT 1;
  
  -- Get reference data
  SELECT id INTO v_mr_id FROM person_title WHERE code = 'mr' LIMIT 1;
  SELECT id INTO v_ms_id FROM person_title WHERE code = 'ms' LIMIT 1;
  SELECT id INTO v_th_cid_id FROM id_document_type WHERE code = 'th_cid' LIMIT 1;
  SELECT id INTO v_ft_id FROM employee_type WHERE code = 'full_time' LIMIT 1;
  SELECT id INTO v_pt_id FROM employee_type WHERE code = 'part_time' LIMIT 1;
  
  -- Create Department if not exists
  INSERT INTO department (code, name_th, company_id, created_by, updated_by)
  VALUES ('ops', 'ปฏิบัติการ', v_default_company_id, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  
  SELECT id INTO v_dept_id FROM department 
    WHERE code = 'ops' AND company_id = v_default_company_id AND deleted_at IS NULL LIMIT 1;
  
  -- Create Position if not exists
  INSERT INTO employee_position (code, name_th, company_id, created_by, updated_by)
  VALUES ('staff', 'พนักงาน', v_default_company_id, v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;
  
  SELECT id INTO v_pos_id FROM employee_position 
    WHERE code = 'staff' AND company_id = v_default_company_id AND deleted_at IS NULL LIMIT 1;
  
  -- 1. Create "สาขา 1" branch for DEFAULT company
  IF NOT EXISTS (
    SELECT 1 FROM branches 
    WHERE company_id = v_default_company_id AND code = '00001' AND deleted_at IS NULL
  ) THEN
    INSERT INTO branches (company_id, code, name, status, is_default, created_by, updated_by)
    VALUES (v_default_company_id, '00001', 'สาขา 1', 'active', FALSE, v_admin_id, v_admin_id)
    RETURNING id INTO v_branch1_id;
    
    -- Grant admin access to the new branch
    INSERT INTO user_branch_access (user_id, branch_id, created_by)
    VALUES (v_admin_id, v_branch1_id, v_admin_id)
    ON CONFLICT DO NOTHING;
  ELSE
    SELECT id INTO v_branch1_id FROM branches 
      WHERE company_id = v_default_company_id AND code = '00001' AND deleted_at IS NULL LIMIT 1;
    
    -- Ensure branch is named 'สาขา 1' for tests (dev-seed may have named it differently)
    UPDATE branches SET name = 'สาขา 1' 
    WHERE id = v_branch1_id AND name != 'สาขา 1';
  END IF;
  
  -- 2. Create employees for HQ (สำนักงานใหญ่) if not exists
  -- FT-001
  IF NOT EXISTS (
    SELECT 1 FROM employees 
    WHERE company_id = v_default_company_id AND lower(employee_number) = 'ft-001' 
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
      'FT-001', v_mr_id, 'Arthit', 'Prasert', v_th_cid_id, '1100000000011', '0810000001', 'arthit@default.com',
      v_ft_id, v_dept_id, v_pos_id, v_default_company_id, v_default_hq_id,
      32000.00, DATE '2024-01-10', 'KBank', '123-4-00001-0',
      TRUE, 15000.00, TRUE, 0.05, 0.05, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE,
      v_admin_id, v_admin_id
    );
  END IF;
  
  -- PT-001
  IF NOT EXISTS (
    SELECT 1 FROM employees 
    WHERE company_id = v_default_company_id AND lower(employee_number) = 'pt-001' 
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
      'PT-001', v_mr_id, 'Prasit', 'Kaewkla', v_th_cid_id, '1100000000111', '0820000001', 'prasit@default.com',
      v_pt_id, v_dept_id, v_pos_id, v_default_company_id, v_default_hq_id,
      120.00, DATE '2024-03-20', 'KBank', '123-4-20100-1',
      TRUE, 9000.00, FALSE, 0.00, 0.00, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE,
      v_admin_id, v_admin_id
    );
  END IF;
  
  -- PT-002
  IF NOT EXISTS (
    SELECT 1 FROM employees 
    WHERE company_id = v_default_company_id AND lower(employee_number) = 'pt-002' 
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
      'PT-002', v_ms_id, 'Waree', 'Thongdee', v_th_cid_id, '1100000000129', '0820000002', 'waree@default.com',
      v_pt_id, v_dept_id, v_pos_id, v_default_company_id, v_default_hq_id,
      135.00, DATE '2024-04-01', NULL, NULL,
      FALSE, NULL, FALSE, 0.00, 0.00, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE,
      v_admin_id, v_admin_id
    );
  END IF;
  
  -- 3. Create employees for Branch 1 (สาขา 1)
  -- FT-101
  IF NOT EXISTS (
    SELECT 1 FROM employees 
    WHERE company_id = v_default_company_id AND lower(employee_number) = 'ft-101' 
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
      'FT-101', v_mr_id, 'Danai', 'Chanthep', v_th_cid_id, '1100000000045', '0810000101', 'danai@default.com',
      v_ft_id, v_dept_id, v_pos_id, v_default_company_id, v_branch1_id,
      40000.00, DATE '2024-01-20', 'Krungsri', '333-3-00004-3',
      TRUE, 15000.00, TRUE, 0.05, 0.05, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE,
      v_admin_id, v_admin_id
    );
  END IF;
  
  -- PT-101
  IF NOT EXISTS (
    SELECT 1 FROM employees 
    WHERE company_id = v_default_company_id AND lower(employee_number) = 'pt-101' 
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
      'PT-101', v_mr_id, 'Gomin', 'Rattana', v_th_cid_id, '1100000000137', '0820000101', 'gomin@default.com',
      v_pt_id, v_dept_id, v_pos_id, v_default_company_id, v_branch1_id,
      150.00, DATE '2024-04-10', 'KBank', '666-6-10100-6',
      TRUE, 7000.00, FALSE, 0.00, 0.00, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE,
      v_admin_id, v_admin_id
    );
  END IF;

  RAISE NOTICE 'Created branch "สาขา 1" and employees for DEFAULT company';
END $$;

COMMIT;
