-- ===== Lookup tables =====

-- คำนำหน้าชื่อ
CREATE TABLE IF NOT EXISTS person_title (
  id   UUID PRIMARY KEY DEFAULT uuidv7(),
  code TEXT UNIQUE NOT NULL,   -- 'mr','mrs','ms'
  name_th TEXT NOT NULL        -- 'นาย','นาง','นางสาว'
);

-- ประเภทบัตร
CREATE TABLE IF NOT EXISTS id_document_type (
  id   UUID PRIMARY KEY DEFAULT uuidv7(),
  code TEXT UNIQUE NOT NULL,   -- 'th_cid','alien_id','other'
  name_th TEXT NOT NULL
);

-- ประเภทพนักงาน
CREATE TABLE IF NOT EXISTS employee_type (
  id   UUID PRIMARY KEY DEFAULT uuidv7(),
  code TEXT UNIQUE NOT NULL,   -- 'full_time','part_time'
  name_th TEXT NOT NULL
);

-- seed ค่าพื้นฐาน (รันครั้งเดียว)
INSERT INTO person_title(code, name_th) VALUES
  ('mr','นาย'),('mrs','นาง'),('ms','นางสาว')
ON CONFLICT (code) DO NOTHING;

INSERT INTO id_document_type(code, name_th) VALUES
  ('th_cid','บัตรประชาชน'),('alien_id','บัตรต่างด้าว'),('other','อื่นๆ')
ON CONFLICT (code) DO NOTHING;

INSERT INTO employee_type(code, name_th) VALUES
  ('full_time','ประจำ'),('part_time','พาร์ทไทม์')
ON CONFLICT (code) DO NOTHING;


CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  employee_number TEXT NOT NULL,                      -- ป้อนเอง, unique เฉพาะคนยังทำงานและไม่ถูกลบ

  title_id UUID NOT NULL REFERENCES person_title(id) ON DELETE RESTRICT,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,

  id_document_type_id UUID NOT NULL REFERENCES id_document_type(id) ON DELETE RESTRICT,
  id_document_number  TEXT NOT NULL,

  phone TEXT NULL,
  email TEXT NULL,

  employee_type_id UUID NOT NULL REFERENCES employee_type(id) ON DELETE RESTRICT,

  -- ค่าจ้างคอลัมน์เดียว: full_time = เงินเดือน/เดือน, part_time = ค่าจ้าง/ชั่วโมง
  base_pay_amount NUMERIC(12,2) NOT NULL,

  employment_start_date DATE NOT NULL,
  employment_end_date   DATE NULL,

  bank_name       TEXT NULL,
  bank_account_no TEXT NULL,

  sso_contribute    BOOLEAN NOT NULL DEFAULT FALSE,
  sso_declared_wage NUMERIC(12,2),

  provident_fund_contribute    BOOLEAN NOT NULL DEFAULT FALSE,
    -- อัตรากองทุนสำรองเลี้ยงชีพ: เก็บแบบทศนิยม (เช่น 0.05 = 5%)
  provident_fund_rate_employee NUMERIC(6,5) NOT NULL,  -- พนักงาน
  provident_fund_rate_employer NUMERIC(6,5) NOT NULL,  -- นายจ้าง (อนาคตอาจใช้คำนวณรายงาน)

  withhold_tax      BOOLEAN NOT NULL DEFAULT FALSE,

  allow_housing     BOOLEAN NOT NULL DEFAULT FALSE,
  allow_water       BOOLEAN NOT NULL DEFAULT FALSE,
  allow_electric    BOOLEAN NOT NULL DEFAULT FALSE,
  allow_internet    BOOLEAN NOT NULL DEFAULT FALSE,
  allow_doctor_fee  BOOLEAN NOT NULL DEFAULT FALSE,

  deleted_at TIMESTAMPTZ NULL,
  deleted_by UUID NULL REFERENCES users(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NOT NULL REFERENCES users(id),

  -- Checks
  CONSTRAINT employees_employee_number_not_blank CHECK (btrim(employee_number) <> ''),
  CONSTRAINT employees_dates_valid CHECK (employment_end_date IS NULL OR employment_end_date >= employment_start_date),
  CONSTRAINT employees_bank_pair CHECK (bank_account_no IS NULL OR bank_name IS NOT NULL),
  CONSTRAINT employees_sso_pair CHECK (
    (NOT sso_contribute AND COALESCE(NEW.sso_declared_wage, 0) <= 0) OR
    (sso_contribute AND COALESCE(NEW.sso_declared_wage, 0) > 0)
  )
);

-- ห้ามซ้ำ employee_number เฉพาะ "ยังทำงานอยู่" และ "ยังไม่ถูกลบ"
CREATE UNIQUE INDEX employees_empno_active_uk
ON employees (lower(employee_number))
WHERE employment_end_date IS NULL AND deleted_at IS NULL;

-- สะดวกค้นหา
CREATE INDEX employees_doc_idx ON employees (id_document_type_id, id_document_number);
CREATE INDEX employees_work_status_idx ON employees (employment_end_date);
CREATE INDEX employees_not_deleted_idx ON employees ((deleted_at IS NULL));

-- updated_at อัตโนมัติ
CREATE TRIGGER tg_employees_set_updated
BEFORE UPDATE ON employees
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ตรวจความสอดคล้องค่าจ้าง + SSO
CREATE OR REPLACE FUNCTION employees_wage_validate()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_code TEXT;
BEGIN
  SELECT code INTO v_code FROM employee_type WHERE id = NEW.employee_type_id;
  IF v_code IS NULL THEN
    RAISE EXCEPTION 'employee_type_id % not found', NEW.employee_type_id;
  END IF;

  -- base_pay_amount ต้องระบุและ > 0
  IF NEW.base_pay_amount IS NULL OR NEW.base_pay_amount <= 0 THEN
    RAISE EXCEPTION 'base_pay_amount must be provided and > 0';
  END IF;

  -- สอดคล้อง SSO
  IF NOT NEW.sso_contribute THEN
    -- ต้องเป็น NULL หรือ 0 เท่านั้น
    IF NEW.sso_declared_wage IS NOT NULL
      AND NEW.sso_declared_wage <> 0 THEN
      RAISE EXCEPTION 'when sso_contribute = false, sso_declared_wage must be NULL or 0';
    END IF;
  ELSE
    -- sso_contribute = true → ต้องกรอกและ > 0
    IF NEW.sso_declared_wage IS NULL
      OR NEW.sso_declared_wage <= 0 THEN
      RAISE EXCEPTION 'when sso_contribute = true, sso_declared_wage must be > 0';
    END IF;
  END IF;

  RETURN NEW;
END$$;

CREATE TRIGGER tg_employees_wage_validate
BEFORE INSERT OR UPDATE ON employees
FOR EACH ROW
EXECUTE FUNCTION employees_wage_validate();

-- View หลัก: ใช้ตารางเดียว (updatable) เหมาะสำหรับ SELECT/UPDATE/DELETE ผ่านวิว
CREATE OR REPLACE VIEW v_employees_active AS
SELECT
  e.*
FROM employees e
WHERE e.employment_end_date IS NULL
  AND e.deleted_at IS NULL
WITH LOCAL CHECK OPTION;  -- ป้องกันการ UPDATE/INSERT ผ่านวิวแล้วทำให้หลุดเงื่อนไข

-- view เสริมแบบ enriched เพื่อรายงาน/แสดงผล
CREATE OR REPLACE VIEW v_employees_active_enriched AS
SELECT
  e.id AS employee_id,
  e.employee_number,
  pt.code AS title_code, pt.name_th AS title_name_th,
  e.first_name, e.last_name,
  (pt.name_th || e.first_name || ' ' || e.last_name) AS full_name_th,
  idt.code AS id_document_type_code, idt.name_th AS id_document_type_name_th,
  e.id_document_number,
  e.phone, e.email,
  et.code AS employee_type_code, et.name_th AS employee_type_name_th,
  e.base_pay_amount,
  CASE et.code
    WHEN 'full_time' THEN 'monthly'
    WHEN 'part_time' THEN 'hourly'
    ELSE 'unknown'
  END AS pay_basis,
  CASE et.code
    WHEN 'full_time' THEN 'บาท/เดือน'
    WHEN 'part_time' THEN 'บาท/ชั่วโมง'
    ELSE NULL
  END AS pay_unit_th,
  e.employment_start_date,
  e.bank_name, e.bank_account_no,
  e.sso_contribute, e.sso_declared_wage,
  e.provident_fund_contribute, e.provident_fund_rate_employee, e.provident_fund_rate_employer,
  e.withhold_tax,
  e.allow_housing, e.allow_water, e.allow_electric, e.allow_internet,
  e.created_at, e.created_by, e.updated_at, e.updated_by
FROM employees e
JOIN person_title      pt  ON pt.id  = e.title_id
JOIN id_document_type  idt ON idt.id = e.id_document_type_id
JOIN employee_type     et  ON et.id  = e.employee_type_id
WHERE e.employment_end_date IS NULL
  AND e.deleted_at IS NULL;
