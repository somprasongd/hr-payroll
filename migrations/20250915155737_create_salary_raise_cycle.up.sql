/*
salary_raise_cycle = รอบปรับเงินเดือน
- สถานะ: pending (แก้ไขได้ + ลบได้), approved (แก้/ลบไม่ได้), rejected (แก้ไม่ได้ + ลบได้)
- มี unique partial index บังคับให้มี pending ได้ครั้งละ 1 รายการ (ที่ยังไม่ถูกลบ)
-เมื่อสร้าง salary_raise_cycle (สถานะเริ่ม pending) ระบบจะสร้าง salary_raise_item ให้พนักงานประจำทุกคน พร้อม snapshot จาก worklog_ft


salary_raise_item = สรุปต่อพนักงาน (auto-create หลังสร้างรอบ)
- เก็บ tenure_days, current_salary/sso, ช่องปรับ raise_percent/amount
- snapshot ยอดจาก worklog_ft (สาย/ลา/OT) ตามช่วง period_start_date .. period_end_date
- อัปเดต snapshot อัตโนมัติเมื่อ worklog_ft มีการเพิ่ม/แก้/ลบแบบ soft (เฉพาะรอบที่ pending)
- new_salary คิดอัตโนมัติจาก base + amount + base*%
- new_sso_wage ใส่ได้เอง (ไม่ใส่จะ default = current_sso_wage)
- ทุกครั้งที่บันทึก (INSERT/UPDATE) จะอัปเดต employees.base_pay_amount และ employees.sso_declared_wage ตามค่าที่ตั้งไว้ทันที
- ถ้ามีการเพิ่ม/แก้ไข/ลบ (soft) ใน worklog_ft ระหว่างช่วงรอบ ระบบจะ อัปเดต snapshot อัตโนมัติ เฉพาะรอบที่ยัง pending

ป้องกันการแก้ไข:
- รายการใน salary_raise_item แก้ได้ เฉพาะเมื่อ cycle.status='pending'
- รอบ salary_raise_cycle อนุมัติแล้ว/ถูกปฏิเสธ → กันแก้ตามกติกา

การค้นหา: ดัชนีบน salary_raise_cycle.created_at และ status พร้อมใช้งาน
*/


-- =============== Domains ===============
-- สถานะรอบปรับเงินเดือน
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'salary_raise_status') THEN
    CREATE DOMAIN salary_raise_status AS TEXT
      CONSTRAINT salary_raise_status_chk
      CHECK (VALUE IN ('pending','approved','rejected'));
  END IF;
END$$;

-- ============ ตารางหลัก (รอบ) ============
DROP TABLE IF EXISTS salary_raise_cycle CASCADE;

CREATE TABLE salary_raise_cycle (
  id          UUID PRIMARY KEY DEFAULT uuidv7(),

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID NOT NULL REFERENCES users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID NOT NULL REFERENCES users(id),

  -- ช่วงรอบการประเมิน (สำหรับไปดึงข้อมูลการทำงาน)
  period_start_date DATE NOT NULL,
  period_end_date   DATE NOT NULL,
  CONSTRAINT salary_raise_cycle_period_ck
    CHECK (period_end_date >= period_start_date),

  status      salary_raise_status NOT NULL DEFAULT 'pending',

  -- soft delete
  deleted_at  TIMESTAMPTZ NULL,
  deleted_by  UUID REFERENCES users(id),

  -- ห้ามลบเมื่อ approved
  CONSTRAINT salary_raise_cycle_soft_delete_guard
    CHECK (status <> 'approved' OR deleted_at IS NULL)
);

-- ดัชนีค้นหา
CREATE INDEX IF NOT EXISTS salary_raise_cycle_created_idx ON salary_raise_cycle (created_at);
CREATE INDEX IF NOT EXISTS salary_raise_cycle_status_idx  ON salary_raise_cycle (status);

-- อนุญาตมีแถวสถานะ pending ได้เพียง 1 แถว (ที่ยังไม่ถูกลบ)
CREATE UNIQUE INDEX IF NOT EXISTS salary_raise_cycle_pending_one_uk
  ON salary_raise_cycle ((1))
  WHERE status = 'pending' AND deleted_at IS NULL;

-- อัปเดต updated_at อัตโนมัติ
DROP TRIGGER IF EXISTS tg_salary_raise_cycle_set_updated ON salary_raise_cycle;
CREATE TRIGGER tg_salary_raise_cycle_set_updated
BEFORE UPDATE ON salary_raise_cycle
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ห้ามแก้ไขเมื่อไม่ใช่ pending (ยกเว้นเปลี่ยนสถานะจาก pending -> approved/rejected,
-- และตั้งค่า deleted_at เฉพาะ pending หรือ rejected ได้)
CREATE OR REPLACE FUNCTION salary_raise_cycle_guard_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'pending' THEN
    -- อนุญาตแก้ช่วงวันที่, และเปลี่ยนสถานะเป็น approved/rejected
    IF NEW.status NOT IN ('pending','approved','rejected') THEN
      RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
    END IF;
  ELSIF OLD.status = 'approved' THEN
    -- อนุมัติแล้ว: ห้ามแก้ทุกอย่าง (รวมทั้งลบ)
    IF ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*) THEN
      RAISE EXCEPTION 'Approved cycle cannot be modified or deleted';
    END IF;
  ELSIF OLD.status = 'rejected' THEN
    -- ไม่อนุมัติ: แก้ไม่ได้ ยกเว้นลบ (soft delete) ได้
    IF (NEW.deleted_at IS NULL AND ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*)) THEN
      RAISE EXCEPTION 'Rejected cycle cannot be modified (only soft delete allowed)';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END$$;

DROP TRIGGER IF EXISTS tg_salary_raise_cycle_guard_update ON salary_raise_cycle;
CREATE TRIGGER tg_salary_raise_cycle_guard_update
BEFORE UPDATE ON salary_raise_cycle
FOR EACH ROW
EXECUTE FUNCTION salary_raise_cycle_guard_update();

-- ========== ตารางสรุปต่อพนักงาน (เฉพาะประจำ) ==========
DROP TABLE IF EXISTS salary_raise_item CASCADE;

CREATE TABLE salary_raise_item (
  id          UUID PRIMARY KEY DEFAULT uuidv7(),
  cycle_id    UUID NOT NULL REFERENCES salary_raise_cycle(id) ON DELETE CASCADE,

  employee_id UUID NOT NULL REFERENCES employees(id),
  -- อายุงาน (วัน) = DATE(cycle.created_at) - employment_start_date
  tenure_days INTEGER NOT NULL,

  -- snapshot ณ เวลาสร้างรอบ
  current_salary      NUMERIC(12,2) NOT NULL,  -- จาก employees.base_pay_amount
  current_sso_wage    NUMERIC(12,2),           -- จาก employees.sso_declared_wage

  -- ปรับเพิ่ม
  raise_percent       NUMERIC(6,2) DEFAULT 0.00,   -- หน่วยเป็น % เก็บประวัติเฉยๆ ว่าขึ้นกี่ %
  raise_amount        NUMERIC(12,2) DEFAULT 0.00,  -- หน่วยเป็นจำนวนเงิน (+/- ได้)

  -- เงินเดือนใหม่ (generated จากสูตร: base + amount)
  new_salary          NUMERIC(12,2)
    GENERATED ALWAYS AS (
      ROUND(current_salary + COALESCE(raise_amount,0), 2)
    ) STORED,

  -- เงินเดือน สปส. ใหม่ (ผู้ใช้กำหนด; ถ้าไม่ใส่ จะเซ็ต= current_sso_wage โดย trigger ตอน INSERT)
  new_sso_wage        NUMERIC(12,2),

  /* ===== Snapshot จาก worklog_ft ภายในช่วงรอบ =====
  หน่วยแนะนำ:
    - late_minutes      : นาที (INT)
    - leave_days        : วัน (NUMERIC)
    - leave_double_days : วัน (NUMERIC)  (ลาแบบ 2 เท่า)
    - leave_hours       : ชั่วโมง (NUMERIC)
    - ot_hours          : ชั่วโมง (NUMERIC)
  */
  late_minutes       INT            NOT NULL DEFAULT 0,
  leave_days         NUMERIC(6,2)   NOT NULL DEFAULT 0.00,
  leave_double_days  NUMERIC(6,2)   NOT NULL DEFAULT 0.00,
  leave_hours        NUMERIC(6,2)   NOT NULL DEFAULT 0.00,
  ot_hours           NUMERIC(6,2)   NOT NULL DEFAULT 0.00,

  -- audit
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID NOT NULL REFERENCES users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID NOT NULL REFERENCES users(id),

  CONSTRAINT salary_raise_item_positive_new CHECK (new_salary > 0),
  CONSTRAINT salary_raise_item_one_per_emp_per_cycle UNIQUE (cycle_id, employee_id)
);

CREATE INDEX IF NOT EXISTS salary_raise_item_cycle_idx ON salary_raise_item (cycle_id);
CREATE INDEX IF NOT EXISTS salary_raise_item_emp_idx   ON salary_raise_item (employee_id);

DROP TRIGGER IF EXISTS tg_salary_raise_item_set_updated ON salary_raise_item;
CREATE TRIGGER tg_salary_raise_item_set_updated
BEFORE UPDATE ON salary_raise_item
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Guard: item แก้ไขได้เฉพาะเมื่อ cycle.status = 'pending' + เติม new_sso_wage = current_sso_wage เมื่อไม่ได้ระบุ (ตอน INSERT)
CREATE OR REPLACE FUNCTION salary_raise_item_guard_edit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM salary_raise_cycle WHERE id = COALESCE(NEW.cycle_id, OLD.cycle_id);
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Items can be edited only when cycle status is pending (current: %)', v_status;
  END IF;

  -- ไม่อนุญาตย้าย employee ไป-มา
  IF TG_OP = 'UPDATE' AND NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
    RAISE EXCEPTION 'employee_id cannot be changed';
  END IF;

  -- เติม new_sso_wage = current_sso_wage ถ้าผู้ใช้ไม่ระบุ (เฉพาะตอน INSERT)
  IF TG_OP = 'INSERT' AND NEW.new_sso_wage IS NULL THEN
    NEW.new_sso_wage := NEW.current_sso_wage;
  END IF;

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS tg_salary_raise_item_guard_edit_bi ON salary_raise_item;
CREATE TRIGGER tg_salary_raise_item_guard_edit_bi
BEFORE INSERT OR UPDATE ON salary_raise_item
FOR EACH ROW
EXECUTE FUNCTION salary_raise_item_guard_edit();

-- ตรวจสอบว่าต้องเป็นพนักงาน Full-time เท่านั้น
CREATE OR REPLACE FUNCTION public.salary_raise_item_validate_employee_type() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE v_emp_type_code TEXT;
BEGIN
  -- ตรวจสอบว่าเป็นพนักงานประจำ (Full-time) เท่านั้น
  SELECT et.code
    INTO v_emp_type_code
  FROM employees e
  JOIN employee_type et ON et.id = e.employee_type_id
  WHERE e.id = NEW.employee_id;

  IF v_emp_type_code IS DISTINCT FROM 'full_time' THEN
    RAISE EXCEPTION 'Validation Error: Only full-time employees are allowed in salary raise items (Employee ID: %)', NEW.employee_id;
  END IF;

  RETURN NEW;
END$$;

-- ลบ Trigger เดิมถ้ามี (เผื่อรันซ้ำ)
DROP TRIGGER IF EXISTS tg_salary_raise_item_validate_type ON public.salary_raise_item;
CREATE TRIGGER tg_salary_raise_item_validate_type
BEFORE INSERT OR UPDATE OF employee_id ON public.salary_raise_item
FOR EACH ROW
EXECUTE FUNCTION public.salary_raise_item_validate_employee_type();

-- สร้างฟังก์ชันที่จะทำงานเมื่อ salary_raise_cycle เปลี่ยนสถานะเป็น approved เท่านั้น โดยจะวนลูปอัปเดตเงินเดือนพนักงานทุกคนในรอบนั้น
CREATE OR REPLACE FUNCTION public.salary_raise_cycle_on_approve() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- ทำงานเฉพาะเมื่อมีการเปลี่ยนสถานะเป็น 'approved'
  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    
    -- อัปเดตฐานเงินเดือนและ SSO Wage ของพนักงานทุกคนที่มีรายการในรอบนี้
    UPDATE employees e
    SET base_pay_amount   = item.new_salary,
        sso_declared_wage = item.new_sso_wage,
        updated_at        = now(),
        updated_by        = NEW.updated_by
    FROM salary_raise_item item
    WHERE item.cycle_id = NEW.id
      AND e.id = item.employee_id
      AND item.new_salary IS NOT NULL; -- กันพลาดกรณีข้อมูลไม่ครบ

  END IF;

  RETURN NEW;
END$$;

-- ลบ Trigger เดิมถ้ามี (เผื่อรันซ้ำ)
DROP TRIGGER IF EXISTS tg_salary_raise_cycle_on_approve ON public.salary_raise_cycle;

-- สร้าง Trigger ใหม่
CREATE TRIGGER tg_salary_raise_cycle_on_approve
AFTER UPDATE ON public.salary_raise_cycle
FOR EACH ROW
EXECUTE FUNCTION public.salary_raise_cycle_on_approve();

-- Helper: คำนวณ snapshot ใหม่จาก worklog_ft ให้ item หนึ่งรายการ
CREATE OR REPLACE FUNCTION salary_raise_item_recompute_snapshot(p_cycle_id UUID, p_employee_id UUID)
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
  FROM salary_raise_cycle
  WHERE id = p_cycle_id;

  -- รวมจาก worklog_ft ภายในช่วง (เฉพาะที่ไม่ถูกลบ และสถานะรอ/อนุมัติ)
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
    AND status IN ('pending','approved');  -- ถ้าต้องการเฉพาะอนุมัติ: เปลี่ยนเป็น status='approved'

  UPDATE salary_raise_item
    SET late_minutes      = v_late_minutes,
        leave_days        = v_leave_days,
        leave_double_days = v_leave_double_days,
        leave_hours       = v_leave_hours,
        ot_hours          = v_ot_hours,
        updated_at        = now()
  WHERE cycle_id = p_cycle_id
    AND employee_id = p_employee_id;
END$$;

-- สร้าง item อัตโนมัติ หลังสร้าง cycle (เฉพาะพนักงานประจำที่ยังทำงาน/ไม่ถูกลบ)
CREATE OR REPLACE FUNCTION salary_raise_cycle_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- สร้างรายการต่อพนักงาน Full-time
  INSERT INTO salary_raise_item (
    cycle_id, employee_id, tenure_days,
    current_salary, current_sso_wage,
    raise_percent, raise_amount, new_sso_wage,
    late_minutes, leave_days, leave_double_days, leave_hours, ot_hours,
    created_by, updated_by
  )
  SELECT
    NEW.id, e.id,
    (DATE(NEW.created_at) - e.employment_start_date) AS tenure_days,
    e.base_pay_amount, e.sso_declared_wage,
    0.00, 0.00,            -- เริ่มต้นยังไม่ปรับ
    e.sso_declared_wage,   -- default new_sso_wage
    -- ===== Snapshot เบื้องต้นจาก worklog_ft =====
    COALESCE((
      SELECT SUM(w.quantity)::INT
      FROM worklog_ft w
      WHERE w.employee_id = e.id
        AND w.entry_type = 'late'
        AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date
        AND w.deleted_at IS NULL
        AND w.status IN ('pending','approved')
    ),0) AS late_minutes,
    COALESCE((
      SELECT SUM(w.quantity)::NUMERIC(6,2)
      FROM worklog_ft w
      WHERE w.employee_id = e.id
        AND w.entry_type = 'leave_day'
        AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date
        AND w.deleted_at IS NULL
        AND w.status IN ('pending','approved')
    ),0.00) AS leave_days,
    COALESCE((
      SELECT SUM(w.quantity)::NUMERIC(6,2)
      FROM worklog_ft w
      WHERE w.employee_id = e.id
        AND w.entry_type = 'leave_double'
        AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date
        AND w.deleted_at IS NULL
        AND w.status IN ('pending','approved')
    ),0.00) AS leave_double_days,
    COALESCE((
      SELECT SUM(w.quantity)::NUMERIC(6,2)
      FROM worklog_ft w
      WHERE w.employee_id = e.id
        AND w.entry_type = 'leave_hours'
        AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date
        AND w.deleted_at IS NULL
        AND w.status IN ('pending','approved')
    ),0.00) AS leave_hours,
    COALESCE((
      SELECT SUM(w.quantity)::NUMERIC(6,2)
      FROM worklog_ft w
      WHERE w.employee_id = e.id
        AND w.entry_type = 'ot'
        AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date
        AND w.deleted_at IS NULL
        AND w.status IN ('pending','approved')
    ),0.00) AS ot_hours,
    NEW.created_by, NEW.updated_by
  FROM employees e
  JOIN employee_type et ON et.id = e.employee_type_id
  WHERE et.code = 'full_time'
    AND e.employment_end_date IS NULL
    AND e.deleted_at IS NULL;

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS tg_salary_raise_cycle_ai ON salary_raise_cycle;
CREATE TRIGGER tg_salary_raise_cycle_ai
AFTER INSERT ON salary_raise_cycle
FOR EACH ROW
EXECUTE FUNCTION salary_raise_cycle_after_insert();

-- เมื่อ worklog_ft เปลี่ยน → อัปเดต snapshot ให้รอบที่ pending
CREATE OR REPLACE FUNCTION worklog_ft_sync_salary_raise_item()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_cycle_id UUID;
  v_start DATE;
  v_end   DATE;
  v_emp   UUID;
  v_new_date DATE;
  v_old_date DATE;
BEGIN
  -- มี pending cycle อยู่ตัวเดียว (ตาม unique partial index)
  SELECT id, period_start_date, period_end_date
    INTO v_cycle_id, v_start, v_end
  FROM salary_raise_cycle
  WHERE status = 'pending' AND deleted_at IS NULL
  LIMIT 1;

  IF v_cycle_id IS NULL THEN
    RAISE NOTICE '[salary_raise] worklog sync skipped (no pending cycle)';
    RETURN NEW; -- ไม่มีรอบ pending ก็ไม่ต้องทำอะไร
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

  RAISE NOTICE '[salary_raise] worklog sync op=% emp=% new_date=% old_date=% cycle=%',
    TG_OP, v_emp, v_new_date, v_old_date, v_cycle_id;

  IF TG_OP = 'INSERT' THEN
    IF v_new_date BETWEEN v_start AND v_end THEN
      RAISE NOTICE '[salary_raise] recompute (insert) emp=% cycle=% date=%', v_emp, v_cycle_id, v_new_date;
      PERFORM salary_raise_item_recompute_snapshot(v_cycle_id, v_emp);
    ELSE
      RAISE NOTICE '[salary_raise] skip recompute (insert date out of range) emp=% date=% range=%..%', v_emp, v_new_date, v_start, v_end;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
      IF v_old_date BETWEEN v_start AND v_end THEN
        RAISE NOTICE '[salary_raise] recompute (update old emp) emp=% cycle=% date=%', OLD.employee_id, v_cycle_id, v_old_date;
        PERFORM salary_raise_item_recompute_snapshot(v_cycle_id, OLD.employee_id);
      ELSE
        RAISE NOTICE '[salary_raise] skip recompute (update old emp date out of range) emp=% date=% range=%..%', OLD.employee_id, v_old_date, v_start, v_end;
      END IF;
      IF v_new_date BETWEEN v_start AND v_end THEN
        RAISE NOTICE '[salary_raise] recompute (update new emp) emp=% cycle=% date=%', NEW.employee_id, v_cycle_id, v_new_date;
        PERFORM salary_raise_item_recompute_snapshot(v_cycle_id, NEW.employee_id);
      ELSE
        RAISE NOTICE '[salary_raise] skip recompute (update new emp date out of range) emp=% date=% range=%..%', NEW.employee_id, v_new_date, v_start, v_end;
      END IF;
      RETURN COALESCE(NEW, OLD);
    END IF;
    -- ถ้ามีการเปลี่ยนวันที่/จำนวน/ประเภท/สถานะ/ลบแบบ soft ให้คำนวณใหม่เมื่อวันที่เกี่ยวข้องกับช่วงรอบ
    IF (v_new_date BETWEEN v_start AND v_end)
      OR (v_old_date BETWEEN v_start AND v_end)
      OR (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at)
      OR (NEW.status     IS DISTINCT FROM OLD.status)
      OR (NEW.entry_type IS DISTINCT FROM OLD.entry_type)
      OR (NEW.quantity   IS DISTINCT FROM OLD.quantity)
    THEN
      RAISE NOTICE '[salary_raise] recompute (update same emp) emp=% cycle=% new_date=% old_date=%', v_emp, v_cycle_id, v_new_date, v_old_date;
      PERFORM salary_raise_item_recompute_snapshot(v_cycle_id, v_emp);
    ELSE
      RAISE NOTICE '[salary_raise] skip recompute (update same emp, no relevant change) emp=%', v_emp;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF v_old_date BETWEEN v_start AND v_end THEN
      RAISE NOTICE '[salary_raise] recompute (delete) emp=% cycle=% date=%', v_emp, v_cycle_id, v_old_date;
      PERFORM salary_raise_item_recompute_snapshot(v_cycle_id, v_emp);
    ELSE
      RAISE NOTICE '[salary_raise] skip recompute (delete date out of range) emp=% date=% range=%..%', v_emp, v_old_date, v_start, v_end;
    END IF;
  END IF;

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS tg_worklog_ft_sync_raise ON worklog_ft;
CREATE TRIGGER tg_worklog_ft_sync_raise
AFTER INSERT OR UPDATE OR DELETE ON worklog_ft
FOR EACH ROW
EXECUTE FUNCTION worklog_ft_sync_salary_raise_item();

-- เมื่อเงินเดือน/SSO ของพนักงานเปลี่ยน → อัปเดต snapshot ในรอบที่ pending
CREATE OR REPLACE FUNCTION salary_raise_sync_item_on_employee_pay()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_cycle_id UUID;
  v_cycle_created DATE;
  v_tenure INT;
BEGIN
  SELECT id, DATE(created_at)
    INTO v_cycle_id, v_cycle_created
  FROM salary_raise_cycle
  WHERE status = 'pending' AND deleted_at IS NULL
  LIMIT 1;

  IF v_cycle_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_tenure := (v_cycle_created - NEW.employment_start_date);

  RAISE NOTICE '[salary_raise] pay sync emp=% cycle=% tenure=% current=% sso=%',
    NEW.id, v_cycle_id, v_tenure, NEW.base_pay_amount, NEW.sso_declared_wage;

  UPDATE salary_raise_item
    SET current_salary   = NEW.base_pay_amount,
        current_sso_wage = NEW.sso_declared_wage,
        raise_amount     = CASE
                             WHEN raise_percent IS NOT NULL AND raise_percent <> 0
                               THEN ROUND(NEW.base_pay_amount * raise_percent / 100, 2)
                             ELSE raise_amount
                           END,
        tenure_days      = v_tenure,
        updated_at       = now()
  WHERE cycle_id = v_cycle_id
    AND employee_id = NEW.id;

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS tg_salary_raise_sync_employee_pay ON employees;
CREATE TRIGGER tg_salary_raise_sync_employee_pay
AFTER UPDATE OF base_pay_amount, sso_declared_wage ON employees
FOR EACH ROW
WHEN (NEW.deleted_at IS NULL)
EXECUTE FUNCTION salary_raise_sync_item_on_employee_pay();
