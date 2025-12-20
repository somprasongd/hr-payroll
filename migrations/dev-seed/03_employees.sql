-- Dev seed: Create employees for all branches
-- Each branch gets 5 employees: 3 Full-time, 2 Part-time
BEGIN;

DO $$
DECLARE
  v_admin_id UUID;
  v_admin2_id UUID;
  v_default_company_id UUID;
  v_company2_id UUID;
  v_default_hq_branch_id UUID;
  v_default_branch1_id UUID;
  v_company2_hq_branch_id UUID;
  v_company2_branch1_id UUID;
  
  -- Title IDs
  v_mr_id UUID;
  v_mrs_id UUID;
  v_ms_id UUID;
  
  -- Document type ID
  v_th_cid_id UUID;
  
  -- Employee type IDs
  v_ft_id UUID;
  v_pt_id UUID;
  
  -- Department & Position IDs (per company)
  v_dept_hr UUID; v_dept_finance UUID; v_dept_sales UUID; v_dept_it UUID; v_dept_ops UUID;
  v_pos_manager UUID; v_pos_lead UUID; v_pos_analyst UUID; v_pos_developer UUID; v_pos_staff UUID;
  
  v_dept_admin2 UUID; v_dept_production UUID; v_dept_warehouse UUID; v_dept_marketing UUID; v_dept_support UUID;
  v_pos_supervisor UUID; v_pos_technician UUID; v_pos_operator UUID; v_pos_clerk UUID; v_pos_helper UUID;

BEGIN
  -- Get user IDs
  SELECT id INTO v_admin_id FROM users WHERE username = 'admin' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_admin2_id FROM users WHERE username = 'admin2' AND deleted_at IS NULL LIMIT 1;
  
  -- Get company IDs
  SELECT id INTO v_default_company_id FROM companies WHERE code = 'DEFAULT' LIMIT 1;
  SELECT id INTO v_company2_id FROM companies WHERE code = 'COMPANY2' LIMIT 1;
  
  -- Get branch IDs for DEFAULT
  SELECT id INTO v_default_hq_branch_id FROM branches 
    WHERE company_id = v_default_company_id AND code = '00000' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_default_branch1_id FROM branches 
    WHERE company_id = v_default_company_id AND code = '00001' AND deleted_at IS NULL LIMIT 1;
  
  -- Get branch IDs for COMPANY2
  SELECT id INTO v_company2_hq_branch_id FROM branches 
    WHERE company_id = v_company2_id AND code = '00000' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_company2_branch1_id FROM branches 
    WHERE company_id = v_company2_id AND code = '00001' AND deleted_at IS NULL LIMIT 1;
  
  -- Get title IDs
  SELECT id INTO v_mr_id FROM person_title WHERE code = 'mr' LIMIT 1;
  SELECT id INTO v_mrs_id FROM person_title WHERE code = 'mrs' LIMIT 1;
  SELECT id INTO v_ms_id FROM person_title WHERE code = 'ms' LIMIT 1;
  
  -- Get document type ID
  SELECT id INTO v_th_cid_id FROM id_document_type WHERE code = 'th_cid' LIMIT 1;
  
  -- Get employee types
  SELECT id INTO v_ft_id FROM employee_type WHERE code = 'full_time' LIMIT 1;
  SELECT id INTO v_pt_id FROM employee_type WHERE code = 'part_time' LIMIT 1;
  
  -- Get departments for DEFAULT
  SELECT id INTO v_dept_hr FROM department WHERE code = 'hr' AND company_id = v_default_company_id AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_dept_finance FROM department WHERE code = 'finance' AND company_id = v_default_company_id AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_dept_sales FROM department WHERE code = 'sales' AND company_id = v_default_company_id AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_dept_it FROM department WHERE code = 'it' AND company_id = v_default_company_id AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_dept_ops FROM department WHERE code = 'ops' AND company_id = v_default_company_id AND deleted_at IS NULL LIMIT 1;
  
  -- Get positions for DEFAULT
  SELECT id INTO v_pos_manager FROM employee_position WHERE code = 'manager' AND company_id = v_default_company_id AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_pos_lead FROM employee_position WHERE code = 'lead' AND company_id = v_default_company_id AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_pos_analyst FROM employee_position WHERE code = 'analyst' AND company_id = v_default_company_id AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_pos_developer FROM employee_position WHERE code = 'developer' AND company_id = v_default_company_id AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_pos_staff FROM employee_position WHERE code = 'staff' AND company_id = v_default_company_id AND deleted_at IS NULL LIMIT 1;
  
  -- Get departments for COMPANY2
  SELECT id INTO v_dept_admin2 FROM department WHERE code = 'admin_dept' AND company_id = v_company2_id AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_dept_production FROM department WHERE code = 'production' AND company_id = v_company2_id AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_dept_warehouse FROM department WHERE code = 'warehouse' AND company_id = v_company2_id AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_dept_marketing FROM department WHERE code = 'marketing' AND company_id = v_company2_id AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_dept_support FROM department WHERE code = 'support' AND company_id = v_company2_id AND deleted_at IS NULL LIMIT 1;
  
  -- Get positions for COMPANY2
  SELECT id INTO v_pos_supervisor FROM employee_position WHERE code = 'supervisor' AND company_id = v_company2_id AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_pos_technician FROM employee_position WHERE code = 'technician' AND company_id = v_company2_id AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_pos_operator FROM employee_position WHERE code = 'operator' AND company_id = v_company2_id AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_pos_clerk FROM employee_position WHERE code = 'clerk' AND company_id = v_company2_id AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_pos_helper FROM employee_position WHERE code = 'helper' AND company_id = v_company2_id AND deleted_at IS NULL LIMIT 1;

  -- =============================================================
  -- DEFAULT COMPANY - HQ Branch (00000) - 5 employees
  -- =============================================================
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
  ) VALUES
  -- FT-001: Full options
  ('FT-001', v_mr_id, 'Arthit', 'Prasert', v_th_cid_id, '1100000000011', '0810000001', 'arthit@default.com',
   v_ft_id, v_dept_hr, v_pos_manager, v_default_company_id, v_default_hq_branch_id,
   32000.00, DATE '2024-01-10', 'KBank', '123-4-00001-0',
   TRUE, 15000.00, TRUE, 0.05, 0.05, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE,
   v_admin_id, v_admin_id),
  -- FT-002: Partial options
  ('FT-002', v_mrs_id, 'Benjamas', 'Sooksai', v_th_cid_id, '1100000000029', '0810000002', 'benjamas@default.com',
   v_ft_id, v_dept_finance, v_pos_analyst, v_default_company_id, v_default_hq_branch_id,
   28000.00, DATE '2024-02-15', 'SCB', '111-2-00002-1',
   TRUE, 14000.00, TRUE, 0.03, 0.03, TRUE, TRUE, FALSE, TRUE, FALSE, FALSE, FALSE, TRUE,
   v_admin_id, v_admin_id),
  -- FT-003: Minimal options
  ('FT-003', v_ms_id, 'Chalida', 'Wongthai', v_th_cid_id, '1100000000037', '0810000003', 'chalida@default.com',
   v_ft_id, v_dept_sales, v_pos_staff, v_default_company_id, v_default_hq_branch_id,
   25000.00, DATE '2024-03-01', 'Bangkok Bank', '222-1-00003-2',
   FALSE, NULL, FALSE, 0.00, 0.00, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, TRUE, FALSE,
   v_admin_id, v_admin_id),
  -- PT-001: Part-time with SSO
  ('PT-001', v_mr_id, 'Prasit', 'Kaewkla', v_th_cid_id, '1100000000111', '0820000001', 'prasit@default.com',
   v_pt_id, v_dept_ops, v_pos_staff, v_default_company_id, v_default_hq_branch_id,
   120.00, DATE '2024-03-20', 'KBank', '123-4-20100-1',
   TRUE, 9000.00, FALSE, 0.00, 0.00, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE,
   v_admin_id, v_admin_id),
  -- PT-002: Part-time without SSO
  ('PT-002', v_ms_id, 'Waree', 'Thongdee', v_th_cid_id, '1100000000129', '0820000002', 'waree@default.com',
   v_pt_id, v_dept_ops, v_pos_staff, v_default_company_id, v_default_hq_branch_id,
   135.00, DATE '2024-04-01', NULL, NULL,
   FALSE, NULL, FALSE, 0.00, 0.00, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE,
   v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;

  -- =============================================================
  -- DEFAULT COMPANY - Branch 1 (00001) - 5 employees
  -- =============================================================
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
  ) VALUES
  -- FT-101
  ('FT-101', v_mr_id, 'Danai', 'Chanthep', v_th_cid_id, '1100000000045', '0810000101', 'danai@default.com',
   v_ft_id, v_dept_sales, v_pos_lead, v_default_company_id, v_default_branch1_id,
   40000.00, DATE '2024-01-20', 'Krungsri', '333-3-00004-3',
   TRUE, 15000.00, TRUE, 0.05, 0.05, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE,
   v_admin_id, v_admin_id),
  -- FT-102
  ('FT-102', v_ms_id, 'Ekkarat', 'Thongchai', v_th_cid_id, '1100000000053', '0810000102', 'ekkarat@default.com',
   v_ft_id, v_dept_it, v_pos_developer, v_default_company_id, v_default_branch1_id,
   35000.00, DATE '2024-02-01', 'KTB', '444-0-00005-4',
   TRUE, 15000.00, TRUE, 0.03, 0.03, TRUE, FALSE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE,
   v_admin_id, v_admin_id),
  -- FT-103
  ('FT-103', v_mrs_id, 'Faisai', 'Meechai', v_th_cid_id, '1100000000061', '0810000103', 'faisai@default.com',
   v_ft_id, v_dept_finance, v_pos_analyst, v_default_company_id, v_default_branch1_id,
   30000.00, DATE '2024-03-15', 'SCB', '555-5-00006-5',
   TRUE, 15000.00, FALSE, 0.00, 0.00, TRUE, TRUE, FALSE, FALSE, TRUE, TRUE, FALSE, FALSE,
   v_admin_id, v_admin_id),
  -- PT-101
  ('PT-101', v_mr_id, 'Gomin', 'Rattana', v_th_cid_id, '1100000000137', '0820000101', 'gomin@default.com',
   v_pt_id, v_dept_ops, v_pos_staff, v_default_company_id, v_default_branch1_id,
   150.00, DATE '2024-04-10', 'KBank', '666-6-10100-6',
   TRUE, 7000.00, FALSE, 0.00, 0.00, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE,
   v_admin_id, v_admin_id),
  -- PT-102
  ('PT-102', v_ms_id, 'Hathai', 'Srisuk', v_th_cid_id, '1100000000145', '0820000102', 'hathai@default.com',
   v_pt_id, v_dept_ops, v_pos_staff, v_default_company_id, v_default_branch1_id,
   140.00, DATE '2024-05-01', NULL, NULL,
   FALSE, NULL, TRUE, 0.02, 0.02, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE,
   v_admin_id, v_admin_id)
  ON CONFLICT DO NOTHING;

  -- =============================================================
  -- COMPANY2 - HQ Branch (00000) - 5 employees
  -- =============================================================
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
  ) VALUES
  -- C2-FT-001
  ('C2-FT-001', v_mr_id, 'Itsara', 'Jongjit', v_th_cid_id, '1200000000011', '0830000001', 'itsara@company2.com',
   v_ft_id, v_dept_production, v_pos_supervisor, v_company2_id, v_company2_hq_branch_id,
   38000.00, DATE '2024-01-05', 'KBank', '789-1-00001-7',
   TRUE, 15000.00, TRUE, 0.05, 0.05, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE,
   v_admin2_id, v_admin2_id),
  -- C2-FT-002
  ('C2-FT-002', v_mrs_id, 'Jutamas', 'Khemkhao', v_th_cid_id, '1200000000029', '0830000002', 'jutamas@company2.com',
   v_ft_id, v_dept_marketing, v_pos_clerk, v_company2_id, v_company2_hq_branch_id,
   26000.00, DATE '2024-02-10', 'SCB', '789-2-00002-8',
   TRUE, 13000.00, FALSE, 0.00, 0.00, TRUE, TRUE, FALSE, TRUE, FALSE, FALSE, TRUE, FALSE,
   v_admin2_id, v_admin2_id),
  -- C2-FT-003
  ('C2-FT-003', v_ms_id, 'Kanokwan', 'Limjira', v_th_cid_id, '1200000000037', '0830000003', 'kanokwan@company2.com',
   v_ft_id, v_dept_admin2, v_pos_clerk, v_company2_id, v_company2_hq_branch_id,
   24000.00, DATE '2024-03-05', 'Bangkok Bank', '789-3-00003-9',
   FALSE, NULL, FALSE, 0.00, 0.00, FALSE, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE, TRUE,
   v_admin2_id, v_admin2_id),
  -- C2-PT-001
  ('C2-PT-001', v_mr_id, 'Lertchai', 'Manee', v_th_cid_id, '1200000000111', '0840000001', 'lertchai@company2.com',
   v_pt_id, v_dept_warehouse, v_pos_helper, v_company2_id, v_company2_hq_branch_id,
   100.00, DATE '2024-04-01', 'KBank', '789-4-10000-1',
   TRUE, 6000.00, FALSE, 0.00, 0.00, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE,
   v_admin2_id, v_admin2_id),
  -- C2-PT-002
  ('C2-PT-002', v_ms_id, 'Malee', 'Noppakao', v_th_cid_id, '1200000000129', '0840000002', 'malee@company2.com',
   v_pt_id, v_dept_support, v_pos_helper, v_company2_id, v_company2_hq_branch_id,
   110.00, DATE '2024-04-15', NULL, NULL,
   FALSE, NULL, FALSE, 0.00, 0.00, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE,
   v_admin2_id, v_admin2_id)
  ON CONFLICT DO NOTHING;

  -- =============================================================
  -- COMPANY2 - Branch 1 (00001) - 5 employees
  -- =============================================================
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
  ) VALUES
  -- C2-FT-101
  ('C2-FT-101', v_mr_id, 'Noppadon', 'Orachai', v_th_cid_id, '1200000000045', '0830000101', 'noppadon@company2.com',
   v_ft_id, v_dept_production, v_pos_technician, v_company2_id, v_company2_branch1_id,
   33000.00, DATE '2024-01-15', 'Krungsri', '890-1-00101-1',
   TRUE, 15000.00, TRUE, 0.04, 0.04, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, TRUE, TRUE,
   v_admin2_id, v_admin2_id),
  -- C2-FT-102
  ('C2-FT-102', v_mrs_id, 'Orawan', 'Pakdee', v_th_cid_id, '1200000000053', '0830000102', 'orawan@company2.com',
   v_ft_id, v_dept_warehouse, v_pos_operator, v_company2_id, v_company2_branch1_id,
   28000.00, DATE '2024-02-20', 'KTB', '890-2-00102-2',
   TRUE, 14000.00, FALSE, 0.00, 0.00, TRUE, FALSE, TRUE, FALSE, TRUE, FALSE, FALSE, TRUE,
   v_admin2_id, v_admin2_id),
  -- C2-FT-103
  ('C2-FT-103', v_ms_id, 'Pornchai', 'Qin', v_th_cid_id, '1200000000061', '0830000103', 'pornchai@company2.com',
   v_ft_id, v_dept_support, v_pos_clerk, v_company2_id, v_company2_branch1_id,
   25000.00, DATE '2024-03-25', 'SCB', '890-3-00103-3',
   FALSE, NULL, TRUE, 0.03, 0.03, FALSE, TRUE, FALSE, TRUE, FALSE, FALSE, TRUE, FALSE,
   v_admin2_id, v_admin2_id),
  -- C2-PT-101
  ('C2-PT-101', v_mr_id, 'Rattana', 'Somboon', v_th_cid_id, '1200000000137', '0840000101', 'rattana@company2.com',
   v_pt_id, v_dept_warehouse, v_pos_helper, v_company2_id, v_company2_branch1_id,
   95.00, DATE '2024-05-01', 'KBank', '890-4-10101-4',
   TRUE, 5000.00, FALSE, 0.00, 0.00, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE,
   v_admin2_id, v_admin2_id),
  -- C2-PT-102
  ('C2-PT-102', v_ms_id, 'Siriwan', 'Thong', v_th_cid_id, '1200000000145', '0840000102', 'siriwan@company2.com',
   v_pt_id, v_dept_support, v_pos_helper, v_company2_id, v_company2_branch1_id,
   105.00, DATE '2024-05-15', 'SCB', '890-5-10102-5',
   FALSE, NULL, FALSE, 0.00, 0.00, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE,
   v_admin2_id, v_admin2_id)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Created 20 employees across 4 branches (5 per branch: 3 FT + 2 PT)';
END $$;

COMMIT;
