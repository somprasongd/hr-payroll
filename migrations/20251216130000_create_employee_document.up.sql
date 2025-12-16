-- สร้างตารางเก็บเอกสารพนักงาน (Employee Documents)
-- รองรับ PDF, JPG, PNG ขนาดสูงสุด 10MB

-- ===== ประเภทเอกสาร (Admin จัดการได้) =====
CREATE TABLE IF NOT EXISTS employee_document_type (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  code TEXT NOT NULL,
  name_th TEXT NOT NULL,
  name_en TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NOT NULL REFERENCES users(id),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES users(id)
);

-- Unique constraint เฉพาะที่ยังไม่ถูกลบ
CREATE UNIQUE INDEX IF NOT EXISTS employee_document_type_code_active_uk
  ON employee_document_type (lower(code))
  WHERE deleted_at IS NULL;

-- Trigger set updated_at
CREATE TRIGGER tg_employee_document_type_set_updated
BEFORE UPDATE ON employee_document_type
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Seed ประเภทเอกสารเริ่มต้น
WITH admin_user AS (
  SELECT id
  FROM users
  WHERE user_role = 'admin' AND deleted_at IS NULL
  ORDER BY created_at
  LIMIT 1
)
INSERT INTO employee_document_type (code, name_th, name_en, created_by, updated_by)
SELECT code, name_th, name_en, au.id, au.id
FROM admin_user au,
(VALUES
  ('passport', 'พาสปอร์ต', 'Passport'),
  ('pink_card', 'บัตรชมพู (บัตรต่างด้าว)', 'Pink Card (Alien ID)'),
  ('visa', 'วีซ่า', 'Visa'),
  ('work_permit', 'ใบอนุญาตทำงาน', 'Work Permit'),
  ('id_card_copy', 'สำเนาบัตรประชาชน', 'ID Card Copy'),
  ('house_registration', 'สำเนาทะเบียนบ้าน', 'House Registration Copy'),
  ('bank_book', 'สำเนาสมุดบัญชีธนาคาร', 'Bank Book Copy'),
  ('other', 'อื่นๆ', 'Other')
) AS t(code, name_th, name_en)
WHERE NOT EXISTS (
  SELECT 1 FROM employee_document_type WHERE code = t.code AND deleted_at IS NULL
);


-- ===== ตารางเก็บไฟล์เอกสาร =====
CREATE TABLE IF NOT EXISTS employee_document (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  document_type_id UUID NOT NULL REFERENCES employee_document_type(id),
  
  -- File data
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,  -- 'application/pdf', 'image/jpeg', 'image/png'
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes BETWEEN 1 AND 10485760), -- Max 10MB
  data BYTEA NOT NULL,
  checksum_md5 TEXT NOT NULL,
  
  -- Document metadata
  document_number TEXT,         -- เลขที่เอกสาร ถ้ามี
  issue_date DATE,              -- วันที่ออก
  expiry_date DATE,             -- วันหมดอายุ
  notes TEXT,                   -- หมายเหตุ
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NOT NULL REFERENCES users(id),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES users(id),
  
  CONSTRAINT employee_document_content_type_check CHECK (
    content_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/jpg')
  ),
  CONSTRAINT employee_document_expiry_after_issue CHECK (
    expiry_date IS NULL OR issue_date IS NULL OR expiry_date >= issue_date
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS employee_document_employee_idx 
  ON employee_document(employee_id) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS employee_document_type_idx 
  ON employee_document(document_type_id) 
  WHERE deleted_at IS NULL;

-- สำหรับ query เอกสารที่จะหมดอายุ
CREATE INDEX IF NOT EXISTS employee_document_expiry_idx 
  ON employee_document(expiry_date) 
  WHERE expiry_date IS NOT NULL AND deleted_at IS NULL;

-- Unique checksum per employee (ป้องกันอัปโหลดไฟล์ซ้ำ)
CREATE UNIQUE INDEX IF NOT EXISTS employee_document_checksum_uk
  ON employee_document(employee_id, checksum_md5)
  WHERE deleted_at IS NULL;

-- Trigger set updated_at
CREATE TRIGGER tg_employee_document_set_updated
BEFORE UPDATE ON employee_document
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- ===== View สำหรับเอกสารใกล้หมดอายุ =====
CREATE OR REPLACE VIEW v_employee_documents_expiring AS
SELECT 
  ed.id AS document_id,
  ed.employee_id,
  e.employee_number,
  e.first_name,
  e.last_name,
  edt.code AS document_type_code,
  edt.name_th AS document_type_name_th,
  edt.name_en AS document_type_name_en,
  ed.file_name,
  ed.expiry_date,
  ed.expiry_date - CURRENT_DATE AS days_until_expiry
FROM employee_document ed
JOIN employees e ON e.id = ed.employee_id
JOIN employee_document_type edt ON edt.id = ed.document_type_id
WHERE ed.deleted_at IS NULL
  AND e.deleted_at IS NULL
  AND e.employment_end_date IS NULL
  AND ed.expiry_date IS NOT NULL
  AND ed.expiry_date >= CURRENT_DATE
ORDER BY ed.expiry_date ASC;
