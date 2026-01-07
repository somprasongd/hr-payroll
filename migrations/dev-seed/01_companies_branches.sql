-- Dev seed: Create companies, branches, users, profiles and configs
-- Creates:
-- 1. DEFAULT company: 2 branches, admin user, profile, config
-- 2. COMPANY2: 2 branches, admin2 user, profile, config
BEGIN;

-- ===== 1. Fix DEFAULT company profiles and configs (Assign to DEFAULT) =====
DO $$
DECLARE
  v_default_company_id UUID;
  v_admin_id UUID;
  v_current_month_start DATE;
BEGIN
  SELECT id INTO v_default_company_id FROM companies WHERE code = 'DEFAULT' LIMIT 1;
  SELECT id INTO v_admin_id FROM users WHERE username = 'admin' AND deleted_at IS NULL LIMIT 1;
  v_current_month_start := date_trunc('month', CURRENT_DATE)::date;

  -- Backfill company_id to existing profiles/configs if they are NULL
  UPDATE payroll_org_profile SET company_id = v_default_company_id WHERE company_id IS NULL;
  UPDATE payroll_config SET company_id = v_default_company_id WHERE company_id IS NULL;
  
  -- Create payroll_org_profile for DEFAULT if not exists
  IF NOT EXISTS (SELECT 1 FROM payroll_org_profile WHERE company_id = v_default_company_id) THEN
    INSERT INTO payroll_org_profile (
      company_id, effective_daterange,
      company_name, status, created_by, updated_by
    ) VALUES (
      v_default_company_id, daterange(v_current_month_start, NULL, '[)'),
      'บริษัท ทดสอบ จำกัด', 'active', v_admin_id, v_admin_id
    );
  END IF;
  
  -- Create payroll_config for DEFAULT if not exists
  IF NOT EXISTS (SELECT 1 FROM payroll_config WHERE company_id = v_default_company_id) THEN
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
      status, note, created_by, updated_by
    ) VALUES (
      v_default_company_id, daterange(v_current_month_start, NULL, '[)'),
      60.00, 60.00,
      500.00, 1000.00,
      1000.00, 10.00, 6.00, 80.00,
      0.05, 0.05, 17500.00,
      TRUE, 0.50, 100000.00,
      TRUE, 60000.00, '[{"min":0,"max":150000,"rate":0},{"min":150000,"max":300000,"rate":0.05},{"min":300000,"max":500000,"rate":0.10},{"min":500000,"max":750000,"rate":0.15},{"min":750000,"max":1000000,"rate":0.20},{"min":1000000,"max":2000000,"rate":0.25},{"min":2000000,"max":5000000,"rate":0.30},{"min":5000000,"max":null,"rate":0.35}]'::jsonb,
      0.03,
      'active', 'ค่าเริ่มต้นสำหรับบริษัท DEFAULT', v_admin_id, v_admin_id
    );
  END IF;
  
  -- Create default branch for DEFAULT if not exists (Handled by migration but safety check)
  -- Create second branch for DEFAULT
  IF NOT EXISTS (
    SELECT 1 FROM branches 
    WHERE company_id = v_default_company_id AND code = '00001' AND deleted_at IS NULL
  ) THEN
    INSERT INTO branches (company_id, code, name, status, is_default, created_by, updated_by)
    VALUES (v_default_company_id, '00001', 'สาขา 1', 'active', FALSE, v_admin_id, v_admin_id);
    
    INSERT INTO user_branch_access (user_id, branch_id, created_by)
    SELECT v_admin_id, id, v_admin_id FROM branches 
    WHERE company_id = v_default_company_id AND code = '00001';
  END IF;
END $$;

-- ===== 2. Create COMPANY2 with full setup =====
DO $$
DECLARE
  v_superadmin_id UUID;
  v_admin2_id UUID;
  v_company2_id UUID;
  v_branch2_default_id UUID;
  v_branch2_second_id UUID;
  v_current_month_start DATE;
BEGIN
  -- Get superadmin or admin for created_by
  SELECT id INTO v_superadmin_id FROM users WHERE username = 'superadmin' AND deleted_at IS NULL LIMIT 1;
  IF v_superadmin_id IS NULL THEN
    SELECT id INTO v_superadmin_id FROM users WHERE username = 'admin' AND deleted_at IS NULL LIMIT 1;
  END IF;
  
  v_current_month_start := date_trunc('month', CURRENT_DATE)::date;
  
  -- Create COMPANY2
  IF NOT EXISTS (SELECT 1 FROM companies WHERE code = 'COMPANY2') THEN
    INSERT INTO companies (code, name, status, created_by, updated_by)
    VALUES ('COMPANY2', 'บริษัท ทดสอบ 2 จำกัด', 'active', v_superadmin_id, v_superadmin_id)
    RETURNING id INTO v_company2_id;
  ELSE
    SELECT id INTO v_company2_id FROM companies WHERE code = 'COMPANY2' LIMIT 1;
  END IF;
  
  -- Create admin2 user
  IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin2' AND deleted_at IS NULL) THEN
    INSERT INTO users (username, password_hash, user_role, created_by, updated_by)
    VALUES (
      'admin2',
      '$argon2id$v=19$m=65536,t=3,p=4$vdCnms0qqpwQwsGkU9tONQ$/wvzZ56+cOqNU2AUQzQxmKAr0x+JrFCL7Qa1YeQxvpg',
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
  
  -- Organization Profile for COMPANY2
  IF NOT EXISTS (SELECT 1 FROM payroll_org_profile WHERE company_id = v_company2_id) THEN
    INSERT INTO payroll_org_profile (
      company_id, effective_daterange,
      company_name, address_line1, address_line2,
      subdistrict, district, province, postal_code,
      phone_main, email, tax_id, status, created_by, updated_by
    ) VALUES (
      v_company2_id, daterange(v_current_month_start, NULL, '[)'),
      'บริษัท ทดสอบ 2 จำกัด', '123/45 ถนนทดสอบ', 'ตำบลทดสอบ',
      'อำเภอเมือง', 'กรุงเทพมหานคร', 'จังหวัดกรุงเทพ', '10110',
      '02-123-4567', 'contact@company2.com', '1234567890123', 'active', v_admin2_id, v_admin2_id
    );
  END IF;

  -- Payroll Config for COMPANY2
  -- Sets different rates from DEFAULT (e.g. higher hourly rate)
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
      status, note, created_by, updated_by
    ) VALUES (
      v_company2_id, daterange(v_current_month_start, NULL, '[)'),
      80.00, 80.00,     -- Higher rates
      600.00, 1200.00,  -- Higher bonuses
      1500.00, 12.00, 7.00, 100.00,
      0.05, 0.05, 17500.00,
      TRUE, 0.50, 100000.00,
      TRUE, 60000.00, '[{"min":0,"max":150000,"rate":0},{"min":150000,"max":300000,"rate":0.05},{"min":300000,"max":500000,"rate":0.10},{"min":500000,"max":750000,"rate":0.15},{"min":750000,"max":1000000,"rate":0.20},{"min":1000000,"max":2000000,"rate":0.25},{"min":2000000,"max":5000000,"rate":0.30},{"min":5000000,"max":null,"rate":0.35}]'::jsonb,
      0.03,
      'active', 'ค่าเริ่มต้นสำหรับบริษัท 2', v_admin2_id, v_admin2_id
    );
  END IF;
  
  -- Create branches for COMPANY2
  IF NOT EXISTS (
    SELECT 1 FROM branches 
    WHERE company_id = v_company2_id AND code = '00000' AND deleted_at IS NULL
  ) THEN
    INSERT INTO branches (company_id, code, name, status, is_default, created_by, updated_by)
    VALUES (v_company2_id, '00000', 'สำนักงานใหญ่', 'active', TRUE, v_admin2_id, v_admin2_id)
    RETURNING id INTO v_branch2_default_id;
  ELSE
    SELECT id INTO v_branch2_default_id FROM branches 
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
    (v_admin2_id, v_branch2_default_id, v_superadmin_id),
    (v_admin2_id, v_branch2_second_id, v_superadmin_id)
  ON CONFLICT DO NOTHING;
  
END $$;

COMMIT;
