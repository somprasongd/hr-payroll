-- Dev seed: Create departments, positions, and document types for all companies
BEGIN;

DO $$
DECLARE
  v_admin_id UUID;
  v_admin2_id UUID;
  v_default_company_id UUID;
  v_company2_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM users WHERE username = 'admin' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_admin2_id FROM users WHERE username = 'admin2' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_default_company_id FROM companies WHERE code = 'DEFAULT' LIMIT 1;
  SELECT id INTO v_company2_id FROM companies WHERE code = 'COMPANY2' LIMIT 1;

  -- DEPARTMENTS
  INSERT INTO department (code, name_th, company_id, created_by, updated_by) VALUES
    ('hr', 'ฝ่ายบุคคล', v_default_company_id, v_admin_id, v_admin_id),
    ('finance', 'การเงิน', v_default_company_id, v_admin_id, v_admin_id),
    ('sales', 'ฝ่ายขาย', v_default_company_id, v_admin_id, v_admin_id),
    ('it', 'ไอที', v_default_company_id, v_admin_id, v_admin_id),
    ('ops', 'ปฏิบัติการ', v_default_company_id, v_admin_id, v_admin_id),
    ('admin_dept', 'ฝ่ายธุรการ', v_company2_id, v_admin2_id, v_admin2_id),
    ('production', 'ฝ่ายผลิต', v_company2_id, v_admin2_id, v_admin2_id),
    ('warehouse', 'คลังสินค้า', v_company2_id, v_admin2_id, v_admin2_id),
    ('marketing', 'การตลาด', v_company2_id, v_admin2_id, v_admin2_id),
    ('support', 'ฝ่ายบริการ', v_company2_id, v_admin2_id, v_admin2_id)
  ON CONFLICT DO NOTHING;

  -- POSITIONS
  INSERT INTO employee_position (code, name_th, company_id, created_by, updated_by) VALUES
    ('manager', 'ผู้จัดการ', v_default_company_id, v_admin_id, v_admin_id),
    ('lead', 'หัวหน้าทีม', v_default_company_id, v_admin_id, v_admin_id),
    ('analyst', 'นักวิเคราะห์', v_default_company_id, v_admin_id, v_admin_id),
    ('staff', 'พนักงาน', v_default_company_id, v_admin_id, v_admin_id),
    ('supervisor', 'หัวหน้างาน', v_company2_id, v_admin2_id, v_admin2_id),
    ('technician', 'ช่างเทคนิค', v_company2_id, v_admin2_id, v_admin2_id),
    ('operator', 'พนักงานปฏิบัติการ', v_company2_id, v_admin2_id, v_admin2_id),
    ('clerk', 'เจ้าหน้าที่', v_company2_id, v_admin2_id, v_admin2_id)
  ON CONFLICT DO NOTHING;

  -- DOCUMENT TYPES (System Level)
  INSERT INTO employee_document_type (code, name_th, name_en, company_id, is_system, created_by, updated_by) VALUES
    ('passport', 'พาสปอร์ต', 'Passport', NULL, TRUE, v_admin_id, v_admin_id),
    ('visa', 'วีซ่า', 'Visa', NULL, TRUE, v_admin_id, v_admin_id),
    ('work_permit', 'ใบอนุญาตทำงาน', 'Work Permit', NULL, TRUE, v_admin_id, v_admin_id),
    ('id_card_copy', 'สำเนาบัตรประชาชน', 'ID Card Copy', NULL, TRUE, v_admin_id, v_admin_id),
    ('bank_book', 'สำเนาสมุดบัญชีธนาคาร', 'Bank Book Copy', NULL, TRUE, v_admin_id, v_admin_id)
  ON CONFLICT (lower(code), COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid)) 
  WHERE deleted_at IS NULL
  DO UPDATE SET name_th = EXCLUDED.name_th, name_en = EXCLUDED.name_en, is_system = TRUE;

  -- DOCUMENT TYPES (Custom for each company)
  INSERT INTO employee_document_type (code, name_th, name_en, company_id, is_system, created_by, updated_by) VALUES
    ('social_security', 'บัตรประกันสังคม', 'Social Security Card', v_default_company_id, FALSE, v_admin_id, v_admin_id),
    ('driving_license', 'ใบขับขี่', 'Driving License', v_default_company_id, FALSE, v_admin_id, v_admin_id),
    ('contract_default', 'สัญญาจ้าง (ทั่วไป)', 'Employment Contract (General)', v_default_company_id, FALSE, v_admin_id, v_admin_id),
    ('diploma', 'วุฒิการศึกษา', 'Diploma/Degree', v_company2_id, FALSE, v_admin2_id, v_admin2_id),
    ('work_permit_custom', 'ใบอนุญาตทำงาน (พนักงานต่างชาติ)', 'Work Permit (Foreign Staff)', v_company2_id, FALSE, v_admin2_id, v_admin2_id),
    ('medical_cert_v2', 'ใบรับรองแพทย์ (ประจำปี)', 'Medical Certificate (Annual)', v_company2_id, FALSE, v_admin2_id, v_admin2_id)
  ON CONFLICT (lower(code), COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid)) 
  WHERE deleted_at IS NULL
  DO UPDATE SET name_th = EXCLUDED.name_th, name_en = EXCLUDED.name_en, is_system = FALSE;

END $$;

COMMIT;
