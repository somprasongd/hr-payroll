-- Seed test data for Document Types tests
-- Creates:
-- 1. System document types (Passport, Visa, etc.)
-- 2. Company-specific document types for DEFAULT
-- 3. Company-specific document types for COMPANY2
--
-- Used by tests:
-- - 14-admin-document-types.spec.ts

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
  
  -- 1. System Document Types (shared across all companies)
  INSERT INTO employee_document_type (code, name_th, name_en, company_id, is_system, created_by, updated_by) VALUES
    ('passport', 'พาสปอร์ต', 'Passport', NULL, TRUE, v_admin_id, v_admin_id),
    ('visa', 'วีซ่า', 'Visa', NULL, TRUE, v_admin_id, v_admin_id),
    ('work_permit', 'ใบอนุญาตทำงาน', 'Work Permit', NULL, TRUE, v_admin_id, v_admin_id),
    ('id_card_copy', 'สำเนาบัตรประชาชน', 'ID Card Copy', NULL, TRUE, v_admin_id, v_admin_id),
    ('bank_book', 'สำเนาสมุดบัญชีธนาคาร', 'Bank Book Copy', NULL, TRUE, v_admin_id, v_admin_id)
  ON CONFLICT (lower(code), COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid)) 
  WHERE deleted_at IS NULL
  DO UPDATE SET name_th = EXCLUDED.name_th, name_en = EXCLUDED.name_en, is_system = TRUE;

  -- 2. Company Document Types for DEFAULT
  INSERT INTO employee_document_type (code, name_th, name_en, company_id, is_system, created_by, updated_by) VALUES
    ('social_security', 'บัตรประกันสังคม', 'Social Security Card', v_default_company_id, FALSE, v_admin_id, v_admin_id),
    ('driving_license', 'ใบขับขี่', 'Driving License', v_default_company_id, FALSE, v_admin_id, v_admin_id),
    ('contract_default', 'สัญญาจ้าง (ทั่วไป)', 'Employment Contract (General)', v_default_company_id, FALSE, v_admin_id, v_admin_id)
  ON CONFLICT (lower(code), COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid)) 
  WHERE deleted_at IS NULL
  DO UPDATE SET name_th = EXCLUDED.name_th, name_en = EXCLUDED.name_en, is_system = FALSE;

  -- 3. Company Document Types for COMPANY2 (if COMPANY2 exists)
  IF v_company2_id IS NOT NULL AND v_admin2_id IS NOT NULL THEN
    INSERT INTO employee_document_type (code, name_th, name_en, company_id, is_system, created_by, updated_by) VALUES
      ('diploma', 'วุฒิการศึกษา', 'Diploma', v_company2_id, FALSE, v_admin2_id, v_admin2_id),
      ('work_permit_custom', 'ใบอนุญาตทำงาน (พนักงานต่างชาติ)', 'Work Permit (Foreign Staff)', v_company2_id, FALSE, v_admin2_id, v_admin2_id),
      ('medical_cert_v2', 'ใบรับรองแพทย์ (ประจำปี)', 'Medical Certificate (Annual)', v_company2_id, FALSE, v_admin2_id, v_admin2_id)
    ON CONFLICT (lower(code), COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid)) 
    WHERE deleted_at IS NULL
    DO UPDATE SET name_th = EXCLUDED.name_th, name_en = EXCLUDED.name_en, is_system = FALSE;
  END IF;

  RAISE NOTICE 'Created document types for system, DEFAULT, and COMPANY2';
END $$;

COMMIT;
