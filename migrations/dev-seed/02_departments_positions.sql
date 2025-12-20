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

  -- DOCUMENT TYPES (Corrected table name: employee_document_type)
  INSERT INTO employee_document_type (code, name, company_id, created_by, updated_by) VALUES
    ('id_card', 'บัตรประชาชน', v_default_company_id, v_admin_id, v_admin_id),
    ('house_reg', 'ทะเบียนบ้าน', v_default_company_id, v_admin_id, v_admin_id),
    ('contract', 'สัญญาจ้าง', v_default_company_id, v_admin_id, v_admin_id),
    ('id_card', 'บัตรประชาชน', v_company2_id, v_admin2_id, v_admin2_id),
    ('work_permit', 'ใบอนุญาตทำงาน', v_company2_id, v_admin2_id, v_admin2_id),
    ('medical_cert', 'ใบรับรองแพทย์', v_company2_id, v_admin2_id, v_admin2_id)
  ON CONFLICT DO NOTHING;

END $$;

COMMIT;
