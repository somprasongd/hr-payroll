/*
=========================
bonus_cycle:
- pending: แก้ไข/ลบได้, และระบบจะอัปเดต snapshot อัตโนมัติเมื่อ worklog_ft เปลี่ยน
- approved: แก้ไข/ลบไม่ได้
- rejected: แก้ไม่ได้ แต่ลบได้
- มีได้ครั้งละ หนึ่ง รอบที่ pending

bonus_item:
- ถูกสร้างอัตโนมัติสำหรับ พนักงานประจำที่ยังทำงาน ทุกคน พร้อม snapshot จาก worklog_ft
- แก้ไขได้เฉพาะเมื่อรอบยัง pending (เช่น กำหนด bonus_months, bonus_amount)

ทริกเกอร์บน worklog_ft จะ recompute snapshot ให้รอบโบนัสที่ pending เท่านั้น
=========================
*/

-- =========================
-- Domains / Status
-- =========================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bonus_status') THEN
    CREATE DOMAIN bonus_status AS TEXT
      CONSTRAINT bonus_status_chk
      CHECK (VALUE IN ('pending','approved','rejected'));
  END IF;
END$$;

-- =========================================
-- 1) ตารางประวัติรอบโบนัส (Bonus Cycle)
-- =========================================
DROP TABLE IF EXISTS bonus_cycle CASCADE;

CREATE TABLE bonus_cycle (
  id           UUID PRIMARY KEY DEFAULT uuidv7(),

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID NOT NULL REFERENCES users(id),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID NOT NULL REFERENCES users(id),

  -- งวดเงินเดือน (เช่น 2025-02-01 แทน "ก.พ. 2568")
  payroll_month_date DATE NOT NULL,
  -- (ออปชัน) บังคับให้เป็นวันแรกของเดือน
  CONSTRAINT bonus_cycle_month_ck
    CHECK (payroll_month_date = date_trunc('month', payroll_month_date)::date),

  -- ช่วงดึงข้อมูลการทำงาน
  period_start_date DATE NOT NULL,
  period_end_date   DATE NOT NULL,
  CONSTRAINT bonus_cycle_period_ck
    CHECK (period_end_date >= period_start_date),

  status       bonus_status NOT NULL DEFAULT 'pending',

  -- soft delete
  deleted_at   TIMESTAMPTZ NULL,
  deleted_by   UUID REFERENCES users(id),

  -- ห้ามลบเมื่อ approved
  CONSTRAINT bonus_cycle_soft_delete_guard
    CHECK (status <> 'approved' OR deleted_at IS NULL)
);

-- ดัชนีค้นหา
CREATE INDEX IF NOT EXISTS bonus_cycle_created_idx ON bonus_cycle (created_at);
CREATE INDEX IF NOT EXISTS bonus_cycle_status_idx  ON bonus_cycle (status);
CREATE INDEX IF NOT EXISTS bonus_cycle_month_idx   ON bonus_cycle (payroll_month_date);

-- อนุญาตมี pending ได้เพียง 1 แถว (ที่ยังไม่ถูกลบ)
CREATE UNIQUE INDEX IF NOT EXISTS bonus_cycle_pending_one_uk
  ON bonus_cycle ((1))
  WHERE status = 'pending' AND deleted_at IS NULL;

-- updated_at อัตโนมัติ
DROP TRIGGER IF EXISTS tg_bonus_cycle_set_updated ON bonus_cycle;
CREATE TRIGGER tg_bonus_cycle_set_updated
BEFORE UPDATE ON bonus_cycle
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Guard: แก้ไขได้เฉพาะตอน pending
CREATE OR REPLACE FUNCTION bonus_cycle_guard_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'pending' THEN
    IF NEW.status NOT IN ('pending','approved','rejected') THEN
      RAISE EXCEPTION 'Invalid status transition: % -> %', OLD.status, NEW.status;
    END IF;
    -- อนุญาตแก้ period_* และ updated_by ตามปกติ
  ELSIF OLD.status = 'approved' THEN
    IF ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*) THEN
      RAISE EXCEPTION 'Approved bonus cycle cannot be modified or deleted';
    END IF;
  ELSIF OLD.status = 'rejected' THEN
    -- แก้ไม่ได้ ยกเว้นลบได้ (soft delete) เท่านั้น
    IF (NEW.deleted_at IS NULL AND ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*)) THEN
      RAISE EXCEPTION 'Rejected bonus cycle cannot be modified (only soft delete allowed)';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END$$;

DROP TRIGGER IF EXISTS tg_bonus_cycle_guard_update ON bonus_cycle;
CREATE TRIGGER tg_bonus_cycle_guard_update
BEFORE UPDATE ON bonus_cycle
FOR EACH ROW
EXECUTE FUNCTION bonus_cycle_guard_update();

-- =========================================
-- 2) ตารางสรุปโบนัสต่อพนักงาน (เฉพาะ Full-time)
-- =========================================
DROP TABLE IF EXISTS bonus_item CASCADE;

CREATE TABLE bonus_item (
  id          UUID PRIMARY KEY DEFAULT uuidv7(),
  cycle_id    UUID NOT NULL REFERENCES bonus_cycle(id) ON DELETE CASCADE,

  employee_id UUID NOT NULL REFERENCES employees(id),

  -- อายุงาน ณ วันที่สร้างรอบ (วัน)
  tenure_days INTEGER NOT NULL,

  -- snapshot เงินเดือนปัจจุบัน
  current_salary   NUMERIC(12,2) NOT NULL,

  -- ===== Snapshot จาก worklog_ft ภายในช่วงรอบ =====
  late_minutes       INT            NOT NULL DEFAULT 0,
  leave_days         NUMERIC(6,2)   NOT NULL DEFAULT 0.00,
  leave_double_days  NUMERIC(6,2)   NOT NULL DEFAULT 0.00,
  leave_hours        NUMERIC(6,2)   NOT NULL DEFAULT 0.00,
  ot_hours           NUMERIC(6,2)   NOT NULL DEFAULT 0.00,

  -- โบนัส: จำนวน "เดือน" (เช่น 1.5 = หนึ่งเดือนครึ่ง) *เก็บเฉยๆเพื่ออ้างอิง*
  bonus_months       NUMERIC(6,2)   DEFAULT 0.00,

  -- จำนวนเงินโบนัส (ให้โปรแกรมคำนวณแล้วส่งมาเก็บ)
  bonus_amount       NUMERIC(14,2)  DEFAULT 0.00,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID NOT NULL REFERENCES users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID NOT NULL REFERENCES users(id),

  CONSTRAINT bonus_item_one_per_emp_per_cycle UNIQUE (cycle_id, employee_id)
);

CREATE INDEX IF NOT EXISTS bonus_item_cycle_idx ON bonus_item (cycle_id);
CREATE INDEX IF NOT EXISTS bonus_item_emp_idx   ON bonus_item (employee_id);

DROP TRIGGER IF EXISTS tg_bonus_item_set_updated ON bonus_item;
CREATE TRIGGER tg_bonus_item_set_updated
BEFORE UPDATE ON bonus_item
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Guard: แก้ไข bonus_item ได้เฉพาะเมื่อ cycle.status = 'pending'
CREATE OR REPLACE FUNCTION bonus_item_guard_edit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM bonus_cycle
  WHERE id = COALESCE(NEW.cycle_id, OLD.cycle_id);

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Bonus items can be edited only when cycle status is pending (current: %)', v_status;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
    RAISE EXCEPTION 'employee_id cannot be changed';
  END IF;

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS tg_bonus_item_guard_edit_bi ON bonus_item;
CREATE TRIGGER tg_bonus_item_guard_edit_bi
BEFORE INSERT OR UPDATE ON bonus_item
FOR EACH ROW
EXECUTE FUNCTION bonus_item_guard_edit();

-- =========================================
-- Snapshot helper: คำนวณใหม่จาก worklog_ft
-- =========================================
CREATE OR REPLACE FUNCTION bonus_item_recompute_snapshot(p_cycle_id UUID, p_employee_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_start DATE;
  v_end   DATE;
  v_late_minutes      INT;
  v_leave_days        NUMERIC(6,2);
  v_leave_double_days NUMERIC(6,2);
  v_leave_hours       NUMERIC(6,2);
  v_ot_hours          NUMERIC(6,2);
BEGIN
  SELECT period_start_date, period_end_date
    INTO v_start, v_end
  FROM bonus_cycle
  WHERE id = p_cycle_id;

  -- รวมจาก worklog_ft: เฉพาะที่ไม่ถูกลบ และสถานะรอ/อนุมัติ
  SELECT
    COALESCE(SUM(CASE WHEN entry_type = 'late'         THEN quantity END), 0)::INT,
    COALESCE(SUM(CASE WHEN entry_type = 'leave_day'    THEN quantity END), 0)::NUMERIC(6,2),
    COALESCE(SUM(CASE WHEN entry_type = 'leave_double' THEN quantity END), 0)::NUMERIC(6,2),
    COALESCE(SUM(CASE WHEN entry_type = 'leave_hours'  THEN quantity END), 0)::NUMERIC(6,2),
    COALESCE(SUM(CASE WHEN entry_type = 'ot'           THEN quantity END), 0)::NUMERIC(6,2)
  INTO
    v_late_minutes, v_leave_days, v_leave_double_days, v_leave_hours, v_ot_hours
  FROM worklog_ft
  WHERE employee_id = p_employee_id
    AND work_date BETWEEN v_start AND v_end
    AND deleted_at IS NULL
    AND status IN ('pending','approved');  -- เปลี่ยนเป็น = 'approved' ได้ตามนโยบาย

  UPDATE bonus_item
    SET late_minutes      = v_late_minutes,
        leave_days        = v_leave_days,
        leave_double_days = v_leave_double_days,
        leave_hours       = v_leave_hours,
        ot_hours          = v_ot_hours,
        updated_at        = now()
  WHERE cycle_id = p_cycle_id
    AND employee_id = p_employee_id;
END$$;

-- =========================================
-- หลังสร้างรอบโบนัส: สร้างรายการอัตโนมัติ + snapshot ครั้งแรก
-- =========================================
CREATE OR REPLACE FUNCTION bonus_cycle_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO bonus_item (
    cycle_id, employee_id, tenure_days,
    current_salary,
    late_minutes, leave_days, leave_double_days, leave_hours, ot_hours,
    bonus_months, bonus_amount,
    created_by, updated_by
  )
  SELECT
    NEW.id, e.id,
    (DATE(NEW.created_at) - e.employment_start_date) AS tenure_days,
    e.base_pay_amount,
    -- snapshot เริ่มต้นจาก worklog_ft ตามช่วงรอบ
    COALESCE((
      SELECT SUM(w.quantity)::INT
      FROM worklog_ft w
      WHERE w.employee_id = e.id
        AND w.entry_type = 'late'
        AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date
        AND w.deleted_at IS NULL
        AND w.status IN ('pending','approved')
    ), 0) AS late_minutes,
    COALESCE((
      SELECT SUM(w.quantity)::NUMERIC(6,2)
      FROM worklog_ft w
      WHERE w.employee_id = e.id
        AND w.entry_type = 'leave_day'
        AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date
        AND w.deleted_at IS NULL
        AND w.status IN ('pending','approved')
    ), 0.00) AS leave_days,
    COALESCE((
      SELECT SUM(w.quantity)::NUMERIC(6,2)
      FROM worklog_ft w
      WHERE w.employee_id = e.id
        AND w.entry_type = 'leave_double'
        AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date
        AND w.deleted_at IS NULL
        AND w.status IN ('pending','approved')
    ), 0.00) AS leave_double_days,
    COALESCE((
      SELECT SUM(w.quantity)::NUMERIC(6,2)
      FROM worklog_ft w
      WHERE w.employee_id = e.id
        AND w.entry_type = 'leave_hours'
        AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date
        AND w.deleted_at IS NULL
        AND w.status IN ('pending','approved')
    ), 0.00) AS leave_hours,
    COALESCE((
      SELECT SUM(w.quantity)::NUMERIC(6,2)
      FROM worklog_ft w
      WHERE w.employee_id = e.id
        AND w.entry_type = 'ot'
        AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date
        AND w.deleted_at IS NULL
        AND w.status IN ('pending','approved')
    ), 0.00) AS ot_hours,
    0.00, 0.00,  -- เริ่มต้น bonus เดือน/จำนวน เป็น 0
    NEW.created_by, NEW.updated_by
  FROM employees e
  JOIN employee_type et ON et.id = e.employee_type_id
  WHERE et.code = 'full_time'
    AND e.employment_end_date IS NULL
    AND e.deleted_at IS NULL;

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS tg_bonus_cycle_ai ON bonus_cycle;
CREATE TRIGGER tg_bonus_cycle_ai
AFTER INSERT ON bonus_cycle
FOR EACH ROW
EXECUTE FUNCTION bonus_cycle_after_insert();

-- =========================================
-- 3) เมื่อ worklog_ft เปลี่ยน -> อัปเดต snapshot ให้รอบโบนัสที่ pending
-- =========================================
CREATE OR REPLACE FUNCTION worklog_ft_sync_bonus_item()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_cycle_id UUID;
  v_start DATE;
  v_end   DATE;
  v_emp   UUID;
  v_new_date DATE;
  v_old_date DATE;
BEGIN
  -- มี pending bonus cycle ได้แค่ 1 (ตาม unique index)
  SELECT id, period_start_date, period_end_date
    INTO v_cycle_id, v_start, v_end
  FROM bonus_cycle
  WHERE status = 'pending' AND deleted_at IS NULL
  LIMIT 1;

  IF v_cycle_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_emp := OLD.employee_id;
    v_old_date := OLD.work_date;
  ELSIF TG_OP = 'INSERT' THEN
    v_emp := NEW.employee_id;
    v_new_date := NEW.work_date;
  ELSE
    v_emp := COALESCE(NEW.employee_id, OLD.employee_id);
    v_new_date := NEW.work_date;
    v_old_date := OLD.work_date;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_new_date BETWEEN v_start AND v_end THEN
      PERFORM bonus_item_recompute_snapshot(v_cycle_id, v_emp);
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
      IF v_old_date BETWEEN v_start AND v_end THEN
        PERFORM bonus_item_recompute_snapshot(v_cycle_id, OLD.employee_id);
      END IF;
      IF v_new_date BETWEEN v_start AND v_end THEN
        PERFORM bonus_item_recompute_snapshot(v_cycle_id, NEW.employee_id);
      END IF;
      RETURN NEW;
    END IF;
    IF (v_new_date BETWEEN v_start AND v_end)
      OR (v_old_date BETWEEN v_start AND v_end)
      OR (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at)
      OR (NEW.status     IS DISTINCT FROM OLD.status)
      OR (NEW.entry_type IS DISTINCT FROM OLD.entry_type)
      OR (NEW.quantity   IS DISTINCT FROM OLD.quantity)
    THEN
      PERFORM bonus_item_recompute_snapshot(v_cycle_id, v_emp);
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF v_old_date BETWEEN v_start AND v_end THEN
      PERFORM bonus_item_recompute_snapshot(v_cycle_id, v_emp);
    END IF;
  END IF;

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS tg_worklog_ft_sync_bonus ON worklog_ft;
CREATE TRIGGER tg_worklog_ft_sync_bonus
AFTER INSERT OR UPDATE OR DELETE ON worklog_ft
FOR EACH ROW
EXECUTE FUNCTION worklog_ft_sync_bonus_item();

-- เมื่อเงินเดือนพนักงานเปลี่ยน → อัปเดต current_salary ให้รอบโบนัสที่ pending
CREATE OR REPLACE FUNCTION bonus_sync_item_on_employee_pay()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_cycle_id UUID;
  v_cycle_created DATE;
  v_tenure INT;
BEGIN
  SELECT id, DATE(created_at)
    INTO v_cycle_id, v_cycle_created
  FROM bonus_cycle
  WHERE status = 'pending' AND deleted_at IS NULL
  LIMIT 1;

  IF v_cycle_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_tenure := (v_cycle_created - NEW.employment_start_date);

  UPDATE bonus_item
    SET current_salary = NEW.base_pay_amount,
        bonus_amount   = CASE
                           WHEN bonus_months IS NOT NULL AND bonus_months <> 0
                             THEN ROUND(NEW.base_pay_amount * bonus_months, 2)
                           ELSE bonus_amount
                         END,
        tenure_days    = v_tenure,
        updated_at     = now()
  WHERE cycle_id = v_cycle_id
    AND employee_id = NEW.id;

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS tg_bonus_sync_employee_pay ON employees;
CREATE TRIGGER tg_bonus_sync_employee_pay
AFTER UPDATE OF base_pay_amount ON employees
FOR EACH ROW
WHEN (NEW.deleted_at IS NULL)
EXECUTE FUNCTION bonus_sync_item_on_employee_pay();
