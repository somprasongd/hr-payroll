-- สถานะการเบิกเงินล่วงหน้า
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'advance_status') THEN
    CREATE DOMAIN advance_status AS TEXT
      CONSTRAINT advance_status_chk
      CHECK (VALUE IN ('pending','processed'));  -- pending=รอคำนวนเงินเดือน, processed=คำนวนเงินแล้ว
  END IF;
END$$;

-- ตารางหลัก: เบิกเงินล่วงหน้า
DROP TABLE IF EXISTS salary_advance CASCADE;

CREATE TABLE salary_advance (
  id                UUID PRIMARY KEY DEFAULT uuidv7(),

  employee_id       UUID NOT NULL REFERENCES employees(id),
  payroll_month_date DATE NOT NULL,                   -- เช่น 2025-02-01 (งวด ก.พ. 2568)
  advance_date       DATE NOT NULL,                   -- วันที่เบิกจริง
  amount             NUMERIC(12,2) NOT NULL CHECK (amount > 0),

  status            advance_status NOT NULL DEFAULT 'pending',

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID NOT NULL REFERENCES users(id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID NOT NULL REFERENCES users(id),

  deleted_at        TIMESTAMPTZ NULL,
  deleted_by        UUID REFERENCES users(id),

  -- payroll_month_date ต้องเป็นวันแรกของเดือน (ช่วยลดความกำกวม)
  CONSTRAINT salary_advance_month_ck
    CHECK (payroll_month_date = date_trunc('month', payroll_month_date)::date),

  -- ลบ (soft) ได้เฉพาะตอน pending เท่านั้น
  CONSTRAINT salary_advance_soft_delete_guard
    CHECK (deleted_at IS NULL OR status = 'pending')
);

-- ดัชนีสำหรับค้นหา ครอบคลุม date-only และ date+status
CREATE INDEX IF NOT EXISTS salary_advance_find_idx
  ON salary_advance (advance_date, status)
  WHERE deleted_at IS NULL;

-- สำหรับคิวรี่ “สถานะอย่างเดียว” บ่อย (เช่น ดูงานค้างทั้งหมด)
CREATE INDEX IF NOT EXISTS salary_advance_status_idx
  ON salary_advance (status)
  WHERE deleted_at IS NULL;

-- สำหรับ join ตอนคำนวณเงินเดือน
CREATE INDEX IF NOT EXISTS salary_advance_emp_month_idx
  ON salary_advance (employee_id, payroll_month_date)
  WHERE deleted_at IS NULL;

-- updated_at อัตโนมัติ
DROP TRIGGER IF EXISTS tg_salary_advance_set_updated ON salary_advance;
CREATE TRIGGER tg_salary_advance_set_updated
BEFORE UPDATE ON salary_advance
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Guard: หลังเป็น processed แล้ว ห้ามแก้ไขใด ๆ (ยกเว้น updated_by ถูกอัปเดตอัตโนมัติ) และห้าม revert สถานะ
CREATE OR REPLACE FUNCTION salary_advance_guard_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'processed' THEN
    -- ห้ามเปลี่ยนค่า/สถานะ/ลบใด ๆ หลังประมวลผลงวดแล้ว
    IF (NEW.status <> 'processed')
      OR (NEW.employee_id IS DISTINCT FROM OLD.employee_id)
      OR (NEW.payroll_month_date IS DISTINCT FROM OLD.payroll_month_date)
      OR (NEW.advance_date IS DISTINCT FROM OLD.advance_date)
      OR (NEW.amount IS DISTINCT FROM OLD.amount)
      OR (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at)
      OR (NEW.deleted_by IS DISTINCT FROM OLD.deleted_by)
    THEN
      RAISE EXCEPTION 'Processed advance cannot be modified or deleted';
    END IF;
  ELSE
    -- สถานะ pending: อนุญาตแก้ไข/ลบได้ตาม constraint ข้างต้น
    -- แต่ไม่อนุญาตกระโดดสถานะผิดปกติ (ค่าที่อนุญาตครอบคลุมโดย DOMAIN แล้ว)
    NULL;
  END IF;

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS tg_salary_advance_guard_update ON salary_advance;
CREATE TRIGGER tg_salary_advance_guard_update
BEFORE UPDATE ON salary_advance
FOR EACH ROW
EXECUTE FUNCTION salary_advance_guard_update();
