-- ต้องใช้สำหรับ exclusion constraint บน daterange
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- สถานะ config (เพื่อสื่อสาร/ค้นหาง่าย ไม่จำเป็นต้องพึ่งเสมอ)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'config_status') THEN
    CREATE TYPE config_status AS ENUM ('active','retired');
  END IF;
END$$;

-- Sequence สำหรับ version_no (กัน race, ไม่ต้องให้แอป SELECT MAX()+1 เอง)
CREATE SEQUENCE IF NOT EXISTS payroll_config_version_seq START 1;

-- ตาราง policy/config สำหรับคำนวณเงินเดือน (single-company)
DROP TABLE IF EXISTS payroll_config CASCADE;

CREATE TABLE payroll_config (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  -- ช่วงวันที่มีผล: [effective_start, effective_end)
  effective_daterange DATERANGE NOT NULL,

  -- เลขเวอร์ชันให้ DB เติมให้อัตโนมัติจาก sequence
  version_no BIGINT NOT NULL DEFAULT nextval('payroll_config_version_seq'),

  -- ค่าต่าง ๆ
  hourly_rate                   NUMERIC(12,2) NOT NULL, -- อัตราค่าจ้างรายชั่วโมง เช่น 70.00
  ot_hourly_rate                NUMERIC(12,2) NOT NULL, -- อัตรา OT รายชั่วโมง เช่น 70.00
  attendance_bonus_no_late      NUMERIC(12,2) NOT NULL, -- เบี้ยขยัน (ไม่สาย) เช่น 500.00
  attendance_bonus_no_leave     NUMERIC(12,2) NOT NULL, -- เบี้ยขยัน (ไม่ลา) เช่น 1000.00
  housing_allowance             NUMERIC(12,2) NOT NULL, -- ค่าห้องพัก เช่น 1000.00
  water_rate_per_unit           NUMERIC(12,2) NOT NULL, -- ค่าน้ำ หน่วยละ เช่น 10.00
  electricity_rate_per_unit     NUMERIC(12,2) NOT NULL, -- ค่าไฟ หน่วยละ เช่น 6.00
  internet_fee_monthly          NUMERIC(12,2) NOT NULL, -- ค่าอินเทอร์เน็ต/เดือน เช่น 80.00

  -- อัตราเงินสมทบประกันสังคม: เก็บแบบทศนิยม (เช่น 0.05 = 5%)
  social_security_rate_employee NUMERIC(6,5) NOT NULL,  -- พนักงาน
  social_security_rate_employer NUMERIC(6,5) NOT NULL,  -- นายจ้าง (อนาคตอาจใช้คำนวณรายงาน)
  social_security_wage_cap      NUMERIC(12,2) NOT NULL DEFAULT 17500.00, -- เพดานค่าจ้างประกันสังคมปี 69
  -- ภาษี: ลูกจ้าง ม.40(1) ใช้ค่าลดหย่อน/หักค่าใช้จ่ายและอัตราก้าวหน้า
  tax_apply_standard_expense    BOOLEAN NOT NULL DEFAULT TRUE,  -- ใช้หักค่าใช้จ่ายเหมา 50%
  tax_standard_expense_rate     NUMERIC(6,5) NOT NULL DEFAULT 0.50, -- อัตราค่าใช้จ่ายเหมา เช่น 0.50 = 50%
  tax_standard_expense_cap      NUMERIC(12,2) NOT NULL DEFAULT 10000.00, -- เพดานค่าใช้จ่ายเหมา
  tax_apply_personal_allowance  BOOLEAN NOT NULL DEFAULT TRUE,  -- ใช้ค่าลดหย่อนส่วนตัว
  tax_personal_allowance_amount NUMERIC(12,2) NOT NULL DEFAULT 60000.00, -- จำนวนค่าลดหย่อนส่วนตัว
  tax_progressive_brackets      JSONB NOT NULL DEFAULT '[{"min":0,"max":150000,"rate":0},{"min":150000,"max":300000,"rate":0.05},{"min":300000,"max":500000,"rate":0.10},{"min":500000,"max":750000,"rate":0.15},{"min":750000,"max":1000000,"rate":0.20},{"min":1000000,"max":2000000,"rate":0.25},{"min":2000000,"max":5000000,"rate":0.30},{"min":5000000,"max":null,"rate":0.35}]'::jsonb, -- อัตราภาษีก้าวหน้า
  -- ภาษี: เหมาบริการ/ฟรีแลนซ์ ม.40(2) ใช้อัตราหัก ณ ที่จ่าย
  withholding_tax_rate_service  NUMERIC(6,5) NOT NULL DEFAULT 0.03, -- อัตราหัก ณ ที่จ่าย เช่น 0.03 = 3%
  
  -- ค่าคำนวณการหักลา/มาสาย
  work_hours_per_day            NUMERIC(4,2) NOT NULL DEFAULT 8.00,  -- ชั่วโมงทำงานต่อวัน (สำหรับคำนวณหักลารายชั่วโมง)
  late_rate_per_minute          NUMERIC(8,2) NOT NULL DEFAULT 5.00,  -- อัตราหักต่อนาที (บาท/นาที) เมื่อสายเกินกำหนด
  late_grace_minutes            INTEGER NOT NULL DEFAULT 15,         -- นาทีที่อนุญาตให้สายโดยไม่หัก
  

  status        config_status NOT NULL DEFAULT 'active',
  note          TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID NOT NULL REFERENCES users(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID NOT NULL REFERENCES users(id)
);


-- ผูก sequence กับคอลัมน์ (จะถูกเก็บ lifecycle ร่วมกัน)
ALTER SEQUENCE payroll_config_version_seq OWNED BY payroll_config.version_no;

-- ไม่ให้เวอร์ชันซ้ำ
CREATE UNIQUE INDEX payroll_config_version_uk ON payroll_config (version_no);

-- คิวรี่ช่วงวันที่มีผลได้เร็ว
CREATE INDEX payroll_config_effective_daterange_idx ON payroll_config USING gist (effective_daterange);

-- คุมค่าตั้งภาษีให้ปลอดภัย
ALTER TABLE payroll_config
  ADD CONSTRAINT payroll_config_tax_brackets_array CHECK (jsonb_typeof(tax_progressive_brackets) = 'array');

ALTER TABLE payroll_config
  ADD CONSTRAINT payroll_config_tax_standard_expense_rate_range CHECK (tax_standard_expense_rate >= 0 AND tax_standard_expense_rate <= 1),
  ADD CONSTRAINT payroll_config_withholding_rate_service_range CHECK (withholding_tax_rate_service >= 0 AND withholding_tax_rate_service <= 1),
  ADD CONSTRAINT payroll_config_tax_standard_expense_cap_min CHECK (tax_standard_expense_cap >= 0),
  ADD CONSTRAINT payroll_config_tax_personal_allowance_min CHECK (tax_personal_allowance_amount >= 0);

-- =============================================
-- สร้างระบบป้องกัน: ต้องเป็น Admin เท่านั้นถึงจะสร้าง Config ใหม่ได้
-- =============================================
-- ฟังก์ชันตรวจสอบสิทธิ์ก่อน Insert ลงตาราง payroll_config
CREATE OR REPLACE FUNCTION payroll_config_guard_create_policy() RETURNS trigger AS $$
DECLARE
    v_creator_role user_role;
BEGIN
    -- 1. ตรวจสอบว่ามี created_by หรือไม่
    IF NEW.created_by IS NULL THEN
        RAISE EXCEPTION 'created_by is required to identify the creator.';
    END IF;

    -- 2. ดึง Role ของคนที่ทำการสร้าง (Creator)
    SELECT user_role INTO v_creator_role 
    FROM users 
    WHERE id = NEW.created_by;

    -- 3. ถ้าคนสร้างไม่ใช่ admin ให้แจ้ง Error และยกเลิก
    IF v_creator_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Access Denied: Only administrators can create new payroll config. (User ID % is %)', NEW.created_by, v_creator_role;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ผูก Trigger กับตาราง payroll_config
CREATE TRIGGER tg_payroll_config_guard_create
BEFORE INSERT ON payroll_config
FOR EACH ROW
EXECUTE FUNCTION payroll_config_guard_create_policy();

-- กันช่วงทับซ้อน (เฉพาะ active ซ้อน active): ตรวจตอน COMMIT (ให้ trigger ได้ทำงานปิดของเก่าก่อน)
ALTER TABLE payroll_config
  ADD CONSTRAINT payroll_config_no_overlap
  EXCLUDE USING gist (
    effective_daterange WITH &&
  )
  WHERE (status = 'active')
  DEFERRABLE INITIALLY DEFERRED;


CREATE TRIGGER tg_payroll_config_set_updated
BEFORE UPDATE ON payroll_config
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- AFTER INSERT: ปิดเวอร์ชันเก่าปลายเปิดให้สิ้นสุดที่ lower(ของใหม่)
CREATE OR REPLACE FUNCTION payroll_config_auto_close_prev()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  start_date DATE;
BEGIN
  start_date := lower(NEW.effective_daterange);

  UPDATE payroll_config pc
  SET effective_daterange = CASE
        WHEN lower(pc.effective_daterange) < start_date
          THEN daterange(lower(pc.effective_daterange), start_date, '[)')
        ELSE pc.effective_daterange -- หากวันเริ่มซ้ำกัน ให้เปลี่ยนแค่สถานะ ไม่แตะช่วงเวลา
      END,
      status              = CASE WHEN pc.status = 'active' THEN 'retired' ELSE pc.status END,
      updated_at          = now(),
      updated_by          = NEW.updated_by
  WHERE pc.id <> NEW.id
    AND upper_inf(pc.effective_daterange); -- ปลายเปิด (infinity)

  RETURN NEW;
END$$;

CREATE TRIGGER tg_payroll_config_auto_close_prev
AFTER INSERT ON payroll_config
FOR EACH ROW
EXECUTE FUNCTION payroll_config_auto_close_prev();

-- ฟังก์ชันหา “คอนฟิกที่มีผล” สำหรับงวด (ใช้ตอนคำนวณงวดที่ยัง pending)
CREATE OR REPLACE FUNCTION get_effective_payroll_config(
  p_period_month DATE
) RETURNS payroll_config LANGUAGE sql AS $$
  SELECT pc.*
  FROM payroll_config pc
  WHERE pc.effective_daterange @> p_period_month
  ORDER BY lower(pc.effective_daterange) DESC, pc.version_no DESC
  LIMIT 1;
$$;

-- ค่า default
WITH admin_user AS (
  SELECT id
  FROM users
  WHERE user_role = 'admin' AND deleted_at IS NULL
  ORDER BY created_at
  LIMIT 1
)
INSERT INTO payroll_config (
  effective_daterange,
  hourly_rate, ot_hourly_rate,
  attendance_bonus_no_late, attendance_bonus_no_leave,
  housing_allowance, water_rate_per_unit, electricity_rate_per_unit,
  internet_fee_monthly,
  social_security_rate_employee, social_security_rate_employer, social_security_wage_cap,
  tax_apply_standard_expense, tax_standard_expense_rate, tax_standard_expense_cap,
  tax_apply_personal_allowance, tax_personal_allowance_amount, tax_progressive_brackets,
  withholding_tax_rate_service,
  work_hours_per_day, late_rate_per_minute, late_grace_minutes,
  status, note, created_by, updated_by
)
SELECT
  daterange(
    date_trunc('month', current_date)::date, -- วันที่ 1 ของเดือน
    NULL::date,
    '[)'
  ),
  70.00, 70.00,
  500.00, 1000.00,
  1000.00, 10.00, 6.00,
  80.00,
  0.05, 0.05, 17500.00,
  TRUE, 0.50, 100000.00,
  TRUE, 60000.00, '[{"min":0,"max":150000,"rate":0},{"min":150001,"max":300000,"rate":0.05},{"min":300001,"max":500000,"rate":0.10},{"min":500001,"max":750000,"rate":0.15},{"min":750001,"max":1000000,"rate":0.20},{"min":1000001,"max":2000000,"rate":0.25},{"min":2000001,"max":5000000,"rate":0.30},{"min":5000001,"max":null,"rate":0.35}]'::jsonb,
  0.03,
  8.00, 5.00, 15,
  'active',
  'ค่าเริ่มต้นของระบบ',
  id, id
FROM admin_user;
