-- =========================
-- 1) Domains (Part-time)
-- =========================
CREATE DOMAIN work_entry_type AS TEXT
  CONSTRAINT work_entry_type_chk
  CHECK (VALUE IN ('late','leave_day','leave_double','leave_hours','ot'));

CREATE DOMAIN worklog_ft_status AS TEXT
  CONSTRAINT worklog_ft_status_chk
  CHECK (VALUE IN ('pending','approved'));

-- ============================================
-- 2) ตารางบันทึกเวลางาน (Full-time)
-- ============================================
CREATE TABLE worklog_ft (
  id           UUID PRIMARY KEY DEFAULT uuidv7(),
  employee_id  UUID NOT NULL REFERENCES employees(id), -- คนที่ถูกบันทึกเวลา
  entry_type   work_entry_type NOT NULL,             -- late / leave_* / ot
  work_date    DATE NOT NULL,                        -- วันที่เกิดเหตุการณ์
  quantity     NUMERIC(8,2) NOT NULL CHECK (quantity > 0),
  status       worklog_ft_status NOT NULL DEFAULT 'pending',

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID NOT NULL REFERENCES users(id),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID NOT NULL REFERENCES users(id),

  deleted_at   TIMESTAMPTZ NULL,
  deleted_by   UUID REFERENCES users(id),

  -- กติกา:
  -- ลบได้เฉพาะเมื่อ pending เท่านั้น
  CONSTRAINT worklog_ft_soft_delete_guard
    CHECK (deleted_at IS NULL OR status = 'pending')
);

-- รวมยอดนิยม: วันที่ + ประเภท + สถานะ (เลือกอันเดียวนี้พอในระยะเริ่ม)
CREATE INDEX worklog_ft_active_dts_idx
  ON worklog_ft (work_date, entry_type, status)
  WHERE deleted_at IS NULL;

-- ถ้าค้นต่อพนักงานบ่อย:
CREATE INDEX worklog_ft_active_emp_date_idx
  ON worklog_ft (employee_id, work_date)
  WHERE deleted_at IS NULL;

-- Prevent duplicate FT worklogs per employee/date/entryType (active rows only)
CREATE UNIQUE INDEX IF NOT EXISTS worklog_ft_emp_date_type_uk
  ON worklog_ft (employee_id, work_date, entry_type)
  WHERE deleted_at IS NULL;

-- 3) อัปเดต updated_at อัตโนมัติเมื่อมีการแก้ไข
DROP TRIGGER IF EXISTS trg_worklog_ft_set_updated ON worklog_ft;
CREATE TRIGGER trg_worklog_ft_set_updated
BEFORE UPDATE ON worklog_ft
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4) กันแก้ field สำคัญเมื่อสถานะไม่ใช่ pending
CREATE OR REPLACE FUNCTION worklog_ft_guard_edit_when_not_pending()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- ถ้าแถวหลังอัปเดต (NEW) ไม่ใช่ pending -> ห้ามแก้ 3 ฟิลด์นี้
  IF NEW.status <> 'pending' THEN
    IF (NEW.entry_type IS DISTINCT FROM OLD.entry_type)
      OR (NEW.work_date  IS DISTINCT FROM OLD.work_date)
      OR (NEW.quantity   IS DISTINCT FROM OLD.quantity)
    THEN
      RAISE EXCEPTION 'Cannot modify entry_type/work_date/quantity when status is % (must be pending)', NEW.status
        USING ERRCODE = 'raise_exception';
    END IF;
  END IF;

  RETURN NEW;
END$$;

-- ติดตั้งทริกเกอร์ (ทำงานก่อนอัปเดตจริง)
DROP TRIGGER IF EXISTS tg_worklog_ft_guard_edit ON worklog_ft;
CREATE TRIGGER tg_worklog_ft_guard_edit
BEFORE UPDATE ON worklog_ft
FOR EACH ROW
EXECUTE FUNCTION worklog_ft_guard_edit_when_not_pending();
