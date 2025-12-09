-- =========================
-- 1) Domains (Part-time)
-- =========================
DROP DOMAIN IF EXISTS worklog_pt_status CASCADE;
CREATE DOMAIN worklog_pt_status AS TEXT
  CONSTRAINT worklog_pt_status_chk
  CHECK (VALUE IN ('pending','approved'));

DROP DOMAIN IF EXISTS payout_pt_status CASCADE;
CREATE DOMAIN payout_pt_status AS TEXT
  CONSTRAINT payout_pt_status_chk
  CHECK (VALUE IN ('to_pay','paid'));

-- ============================================
-- 2) ตารางลงเวลา Part-time (ต่อวัน/คน/แถวเดียว)
-- ============================================
DROP TABLE IF EXISTS worklog_pt CASCADE;

CREATE TABLE worklog_pt (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  employee_id UUID NOT NULL REFERENCES employees(id),

  work_date DATE NOT NULL,               -- วันที่ทำงาน

  -- รอบเช้า
  morning_in   TIME,
  morning_out  TIME,
  morning_minutes INT
    GENERATED ALWAYS AS (
      CASE
        WHEN morning_in IS NOT NULL AND morning_out IS NOT NULL
            AND morning_out > morning_in
        THEN (EXTRACT(EPOCH FROM (morning_out - morning_in)) / 60)::INT
        ELSE 0
      END
    ) STORED,

  -- รอบเย็น
  evening_in   TIME,
  evening_out  TIME,
  evening_minutes INT
    GENERATED ALWAYS AS (
      CASE
        WHEN evening_in IS NOT NULL AND evening_out IS NOT NULL
            AND evening_out > evening_in
        THEN (EXTRACT(EPOCH FROM (evening_out - evening_in)) / 60)::INT
        ELSE 0
      END
    ) STORED,

  -- รวมทั้งหมด (คำนวณจากคู่เวลาโดยตรง เพื่อไม่อ้าง generated column อื่น)
  total_minutes INT
    GENERATED ALWAYS AS (
      COALESCE(
        CASE
          WHEN morning_in IS NOT NULL AND morning_out IS NOT NULL
              AND morning_out > morning_in
          THEN (EXTRACT(EPOCH FROM (morning_out - morning_in)) / 60)::INT
          ELSE 0
        END, 0
      )
      +
      COALESCE(
        CASE
          WHEN evening_in IS NOT NULL AND evening_out IS NOT NULL
              AND evening_out > evening_in
          THEN (EXTRACT(EPOCH FROM (evening_out - evening_in)) / 60)::INT
          ELSE 0
        END, 0
      )
    ) STORED,

  total_hours NUMERIC(10,2)
    GENERATED ALWAYS AS (
      ROUND((
        COALESCE(
          CASE
            WHEN morning_in IS NOT NULL AND morning_out IS NOT NULL
                AND morning_out > morning_in
            THEN (EXTRACT(EPOCH FROM (morning_out - morning_in)) / 60)::INT
            ELSE 0
          END, 0
        )
        +
        COALESCE(
          CASE
            WHEN evening_in IS NOT NULL AND evening_out IS NOT NULL
                AND evening_out > evening_in
            THEN (EXTRACT(EPOCH FROM (evening_out - evening_in)) / 60)::INT
            ELSE 0
          END, 0
        )
      )::numeric / 60.0, 2)
    ) STORED,

  status worklog_pt_status NOT NULL DEFAULT 'pending',

  -- audit & soft delete
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NOT NULL REFERENCES users(id),

  deleted_at TIMESTAMPTZ NULL,
  deleted_by UUID REFERENCES users(id),

  -- กติกา:
  -- 1) ถ้าลบ (soft) ต้องเป็นสถานะ pending เท่านั้น
  CONSTRAINT worklog_pt_soft_delete_guard
    CHECK (deleted_at IS NULL OR status = 'pending'),

  -- 2) ถ้ากรอกเวลา ต้อง out > in (กันคีย์ผิดทิศ)
  CONSTRAINT worklog_pt_morning_pair CHECK (
    morning_in IS NULL OR morning_out IS NULL OR morning_out > morning_in
  ),
  CONSTRAINT worklog_pt_evening_pair CHECK (
    evening_in IS NULL OR evening_out IS NULL OR evening_out > evening_in
  )
);

-- ดัชนีเพื่อค้นหา
CREATE INDEX worklog_pt_filter_idx
  ON worklog_pt (work_date, status)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS worklog_pt_emp_date_uk
  ON worklog_pt (employee_id, work_date)
  WHERE deleted_at IS NULL;

-- updatable timestamp
DROP TRIGGER IF EXISTS tg_worklog_pt_set_updated ON worklog_pt;
CREATE TRIGGER tg_worklog_pt_set_updated
BEFORE UPDATE ON worklog_pt
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ห้ามแก้ไขฟิลด์เวลา/วันที่/พนักงาน ถ้าไม่ใช่สถานะ pending
CREATE OR REPLACE FUNCTION worklog_pt_no_edit_after_approved()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'pending' THEN
    IF  (NEW.employee_id    IS DISTINCT FROM OLD.employee_id) OR
        (NEW.work_date      IS DISTINCT FROM OLD.work_date) OR
        (NEW.morning_in     IS DISTINCT FROM OLD.morning_in) OR
        (NEW.morning_out    IS DISTINCT FROM OLD.morning_out) OR
        (NEW.evening_in     IS DISTINCT FROM OLD.evening_in) OR
        (NEW.evening_out    IS DISTINCT FROM OLD.evening_out)
    THEN
      RAISE EXCEPTION 'Cannot edit time fields when status is %, only status transitions allowed', OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS tg_worklog_pt_no_edit ON worklog_pt;
CREATE TRIGGER tg_worklog_pt_no_edit
BEFORE UPDATE ON worklog_pt
FOR EACH ROW
EXECUTE FUNCTION worklog_pt_no_edit_after_approved();

-- ====================================
-- 3) ตารางสรุปการจ่าย (Payout/Batch)
-- ====================================
DROP TABLE IF EXISTS payout_pt CASCADE;

CREATE TABLE payout_pt (
  id UUID PRIMARY KEY DEFAULT uuidv7(),

  employee_id UUID NOT NULL REFERENCES employees(id),
  status payout_pt_status NOT NULL DEFAULT 'to_pay',

  -- สรุปชั่วโมง/ยอด ณ เวลาสร้าง payout (freeze)
  total_minutes INT NOT NULL DEFAULT 0,
  total_hours   NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  hourly_rate_used NUMERIC(12,2) NOT NULL,   -- snapshot จาก employees.base_pay_amount
  amount_total  NUMERIC(14,2) NOT NULL DEFAULT 0.00,

  -- ผู้สร้าง/ผู้จ่าย
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES users(id),

  paid_at TIMESTAMPTZ NULL,
  paid_by UUID NULL REFERENCES users(id),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NOT NULL REFERENCES users(id),

  deleted_at TIMESTAMPTZ NULL,
  deleted_by UUID NULL REFERENCES users(id),

  -- ลบได้เฉพาะตอนยัง "to_pay"
  CONSTRAINT payout_pt_soft_delete_guard
    CHECK (deleted_at IS NULL OR status = 'to_pay'),

  -- เมื่อสถานะเป็น paid ต้องมี paid_by / paid_at
  CONSTRAINT payout_pt_paid_pair CHECK (
    (status <> 'paid' AND paid_by IS NULL AND paid_at IS NULL)
    OR
    (status = 'paid'  AND paid_by IS NOT NULL AND paid_at IS NOT NULL)
  )
);

CREATE INDEX payout_pt_filter_idx
  ON payout_pt (status, employee_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS tg_payout_pt_set_updated ON payout_pt;
CREATE TRIGGER tg_payout_pt_set_updated
BEFORE UPDATE ON payout_pt
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- รายการเชื่อม Worklog -> Payout (หนึ่งรายการเวลางาน อยู่ได้ใน payout เดียว)
DROP TABLE IF EXISTS payout_pt_item CASCADE;

CREATE TABLE payout_pt_item (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  payout_id  UUID NOT NULL REFERENCES payout_pt(id) ON DELETE CASCADE,
  worklog_id UUID NOT NULL REFERENCES worklog_pt(id) ON DELETE RESTRICT,

  deleted_at TIMESTAMPTZ NULL,
  deleted_by UUID NULL REFERENCES users(id)
);

-- สร้าง partial unique: ซ้ำได้เฉพาะเมื่อแถวเก่า "ถูกลบแล้ว"
CREATE UNIQUE INDEX IF NOT EXISTS payout_pt_item_worklog_active_uk
  ON payout_pt_item (worklog_id)
  WHERE deleted_at IS NULL;

-- สรุปยอดใหม่ + อัปเดตสถานะ worklog เมื่อเพิ่ม/ลบ item
CREATE OR REPLACE FUNCTION payout_pt_recalc_and_sync(p_payout_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_emp UUID;
  v_rate NUMERIC(12,2);
  v_total_minutes INT;
  v_amount NUMERIC(14,2);
BEGIN
  -- ยืนยัน employee id ของ payout
  SELECT employee_id INTO v_emp FROM payout_pt WHERE id = p_payout_id FOR UPDATE;
  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'payout % not found', p_payout_id;
  END IF;

  -- ตรวจรายการ worklog ต้องเป็นของพนักงานเดียวกัน และยังไม่ถูกลบ
  IF EXISTS (
    SELECT 1
    FROM payout_pt_item i
    JOIN worklog_pt w ON w.id = i.worklog_id
    WHERE i.payout_id = p_payout_id
      AND i.deleted_at IS NULL     -- นับเฉพาะ active
      AND w.employee_id <> v_emp
  ) THEN
    RAISE EXCEPTION 'Worklog items must belong to the same employee as payout';
  END IF;

  -- ล็อกเรท ณ ปัจจุบันไว้ใน payout ถ้ายังไม่มี (สร้างครั้งแรก)
  IF (SELECT hourly_rate_used FROM payout_pt WHERE id = p_payout_id) IS NULL THEN
    SELECT base_pay_amount INTO v_rate FROM employees WHERE id = v_emp;
    UPDATE payout_pt SET hourly_rate_used = v_rate WHERE id = p_payout_id;
  END IF;

  -- รวมเวลาจากรายการที่ยัง active
  SELECT COALESCE(SUM(w.total_minutes),0)
    INTO v_total_minutes
  FROM payout_pt_item i
  JOIN worklog_pt w ON w.id = i.worklog_id
  WHERE i.payout_id = p_payout_id
    AND i.deleted_at IS NULL;

  -- คำนวณยอดรวม
  SELECT hourly_rate_used INTO v_rate FROM payout_pt WHERE id = p_payout_id;
  v_amount := ROUND((v_total_minutes::numeric / 60.0) * v_rate, 2);

  UPDATE payout_pt
    SET total_minutes = v_total_minutes,
        total_hours   = ROUND(v_total_minutes::numeric / 60.0, 2),
        amount_total  = v_amount
  WHERE id = p_payout_id;
END$$;

-- เมื่อเพิ่ม item: ตั้ง worklog.status -> 'approved' (รับทั้งเดิมเป็น pending/approved)
CREATE OR REPLACE FUNCTION payout_pt_item_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM worklog_pt WHERE id = NEW.worklog_id FOR UPDATE;
  IF v_status NOT IN ('pending','approved') THEN
    RAISE EXCEPTION 'Worklog % must be pending or approved to add into payout (current: %)', NEW.worklog_id, v_status;
  END IF;

  UPDATE worklog_pt
    SET status = 'approved', updated_at = now()
  WHERE id = NEW.worklog_id;

  PERFORM payout_pt_recalc_and_sync(NEW.payout_id);
  RETURN NEW;
END$$;

-- เมื่อถอน item: revert 'approved' -> 'pending'
CREATE OR REPLACE FUNCTION payout_pt_item_after_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM worklog_pt WHERE id = OLD.worklog_id FOR UPDATE;
  IF v_status = 'approved' THEN
    UPDATE worklog_pt
      SET status = 'pending', updated_at = now()
    WHERE id = OLD.worklog_id;
  END IF;

  PERFORM payout_pt_recalc_and_sync(OLD.payout_id);
  RETURN OLD;
END$$;

DROP TRIGGER IF EXISTS tg_payout_pt_item_ai ON payout_pt_item;
CREATE TRIGGER tg_payout_pt_item_ai
AFTER INSERT ON payout_pt_item
FOR EACH ROW
EXECUTE FUNCTION payout_pt_item_after_insert();

DROP TRIGGER IF EXISTS tg_payout_pt_item_ad ON payout_pt_item;
CREATE TRIGGER tg_payout_pt_item_ad
AFTER DELETE ON payout_pt_item
FOR EACH ROW
EXECUTE FUNCTION payout_pt_item_after_delete();

CREATE OR REPLACE FUNCTION payout_pt_after_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'paid' AND OLD.status <> 'paid' THEN
    IF NEW.paid_by IS NULL OR NEW.paid_at IS NULL THEN
      RAISE EXCEPTION 'paid_by and paid_at are required when status=paid';
    END IF;

  ELSIF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    -- Soft delete payout: mark items deleted และ revert worklogs -> pending
    UPDATE payout_pt_item
      SET deleted_at = now(), deleted_by = NEW.deleted_by
    WHERE payout_id = NEW.id
      AND deleted_at IS NULL;

    UPDATE worklog_pt w
      SET status = 'pending', updated_at = now()
    FROM payout_pt_item i
    WHERE i.payout_id = NEW.id
      AND i.deleted_at IS NOT NULL          -- เพิ่งถูก soft delete ไป
      AND w.id = i.worklog_id
      AND w.status = 'approved';

    -- ปรับยอดใน payout (จะเป็น 0 หลังลบ items ออก)
    PERFORM payout_pt_recalc_and_sync(NEW.id);
  END IF;

  -- ห้ามแก้อะไรหลังจ่ายแล้ว (ยกเว้นอัปเดต updated_by/updated_at)
  IF OLD.status = 'paid' AND (ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*)) THEN
    RAISE EXCEPTION 'Cannot modify payout once it is paid';
  END IF;

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS tg_payout_pt_au ON payout_pt;
CREATE TRIGGER tg_payout_pt_au
AFTER UPDATE ON payout_pt
FOR EACH ROW
EXECUTE FUNCTION payout_pt_after_update();

-- ซิงก์เรทไปยัง payout ที่ยังไม่ได้จ่าย (to_pay) ของพนักงานที่ถูกแก้ base_pay_amount
CREATE OR REPLACE FUNCTION employees_sync_payout_rate_after_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_pid UUID;
BEGIN
  -- อัปเดตเฉพาะเมื่อเรทเปลี่ยนจริง ๆ
  IF NEW.base_pay_amount IS DISTINCT FROM OLD.base_pay_amount THEN
    -- 1) อัปเดต hourly_rate_used ของทุก payout ที่ยัง to_pay (และไม่ถูกลบ)
    UPDATE payout_pt
      SET hourly_rate_used = NEW.base_pay_amount,
          -- ใช้ผู้แก้ไขเดียวกับที่แก้พนักงาน (ถ้ามี) เพื่อให้ audit สะท้อนผู้กระทำ
          updated_by = COALESCE(NEW.updated_by, updated_by)
    WHERE employee_id = NEW.id
      AND status = 'to_pay'
      AND deleted_at IS NULL;

    -- 2) คำนวณยอดใหม่ให้ทุก payout ที่ได้รับผล
    FOR v_pid IN
      SELECT id
      FROM payout_pt
      WHERE employee_id = NEW.id
        AND status = 'to_pay'
        AND deleted_at IS NULL
    LOOP
      PERFORM payout_pt_recalc_and_sync(v_pid);
    END LOOP;
  END IF;

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS tg_employees_sync_payout_rate ON employees;
CREATE TRIGGER tg_employees_sync_payout_rate
AFTER UPDATE OF base_pay_amount ON employees
FOR EACH ROW
EXECUTE FUNCTION employees_sync_payout_rate_after_update();
