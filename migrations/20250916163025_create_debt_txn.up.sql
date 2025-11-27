/* ====================================
ประเภท:
- loan (กู้ยืม), other (หนี้อื่นๆ), repayment (ชำระคืนเพื่อลดยอด), installment (ผ่อนชำระหักงวดเงินเดือน)
สถานะ: pending, approved
เฉพาะ installment:
- ต้องมี parent_id (ชี้ไป loan/other ของพนักงานเดียวกัน)
- ต้องมี payroll_month_date และเป็น “วันแรกของเดือน”
- ตอน บันทึก ถูกบังคับให้ status='pending'
- แก้ไข/ลบ (soft) ได้เฉพาะเมื่อ parent ยัง pending
ทุกประเภท:
- แถวที่ approved แล้ว แก้/ลบไม่ได้
- ลบแบบ soft ได้เฉพาะเมื่อแถวนั้น pending (และถ้าเป็น installment ต้องตรวจ parent ตามกติกา)
parent (loan/other)
- เมื่อ parent ถูก soft delete (deleted_at: NULL → NOT NULL) → อัปเดตลูกทุกแถวที่ txn_type='installment' AND status='pending' ให้ใส่ deleted_at/deleted_by ตาม parent
- ถ้ายังมีลูก installment ที่ status <> 'pending' และยังไม่ถูกลบ → บล็อก การลบ parent (raise error) เพื่อกันข้อมูลขัดแย้งกับกติกา “ลูกลบได้เฉพาะเมื่อ parent ยัง pending”
   ==================================== */
-- ====================================
-- 1) Domains: ประเภท & สถานะ
-- ====================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'debt_txn_type') THEN
    /*
      loan        = กู้ยืม
      other       = หนี้อื่นๆ
      repayment   = ชำระคืน (บันทึกลดยอด ไม่ผูกงวดเดือน)
      installment = ผ่อนชำระ (หักงวดเงินเดือน)
    */
    CREATE DOMAIN debt_txn_type AS TEXT
      CONSTRAINT debt_txn_type_chk
      CHECK (VALUE IN ('loan','other','repayment','installment'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'debt_status') THEN
    CREATE DOMAIN debt_status AS TEXT
      CONSTRAINT debt_status_chk
      CHECK (VALUE IN ('pending','approved'));
  END IF;
END$$;

-- ====================================
-- 2) ตารางธุรกรรมหนี้/กู้/ชำระ/ผ่อน
-- ====================================
DROP TABLE IF EXISTS debt_txn CASCADE;

CREATE TABLE debt_txn (
  id           UUID PRIMARY KEY DEFAULT uuidv7(),

  employee_id  UUID NOT NULL REFERENCES employees(id),

  txn_date     DATE NOT NULL,                 -- วันที่ทำรายการ
  txn_type     debt_txn_type NOT NULL,        -- loan/other/repayment/installment
  other_desc   TEXT NULL,                     -- บังคับเมื่อ txn_type='other'

  amount       NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  reason       TEXT NULL,

  -- ใช้เฉพาะประเภท "ผ่อนชำระ" (installment) เพื่อหักงวดเงินเดือน
  payroll_month_date DATE NULL,               -- เช่น 2025-02-01 (วันแรกของเดือนเท่านั้น)

  status       debt_status NOT NULL DEFAULT 'pending',

  -- ผูกกลับไปยังรายการแม่ (loan/other) กรณีเป็น "ผ่อนชำระ"
  parent_id    UUID NULL REFERENCES debt_txn(id) ON DELETE RESTRICT,

  -- audit / soft delete
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID NOT NULL REFERENCES users(id),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID NOT NULL REFERENCES users(id),
  deleted_at   TIMESTAMPTZ NULL,
  deleted_by   UUID REFERENCES users(id),

  -- ===== CHECKs ภายในแถว =====
  -- 1) ถ้า other -> ต้องระบุ other_desc
  CONSTRAINT debt_txn_other_desc_ck
    CHECK (txn_type <> 'other' OR (other_desc IS NOT NULL AND length(btrim(other_desc)) > 0)),

  -- 2) กติกา payroll_month_date:
  --    - installment: ต้องมี และเป็นวันแรกของเดือน
  --    - อื่น ๆ: ต้องเป็น NULL
  CONSTRAINT debt_txn_payroll_month_ck
    CHECK (
      (txn_type = 'installment' AND payroll_month_date IS NOT NULL
        AND payroll_month_date = date_trunc('month', payroll_month_date)::date)
      OR
      (txn_type IN ('loan','other','repayment') AND payroll_month_date IS NULL)
    ),

  -- 3) กติกา parent_id:
  --    - installment: ต้องมี parent_id
  --    - อื่น ๆ: ต้องเป็น NULL
  CONSTRAINT debt_txn_parent_ck
    CHECK (
      (txn_type = 'installment' AND parent_id IS NOT NULL)
      OR
      (txn_type IN ('loan','other','repayment') AND parent_id IS NULL)
    ),

  -- 4) soft delete:
  --    - อนุญาตเมื่อสถานะของรายการนั้นเป็น pending
  --    - (กรณี installment จะมีเงื่อนไขเสริมใน trigger: parent ต้องยัง pending)
  CONSTRAINT debt_txn_soft_delete_ck
    CHECK (deleted_at IS NULL OR status = 'pending')
);

-- ====================================
-- 3) ดัชนีสำหรับค้นหา
--    (ใส่ WHERE deleted_at IS NULL ในคิวรีเพื่อใช้ partial indexes)
-- ====================================
CREATE INDEX IF NOT EXISTS debt_txn_find_date_status_idx
  ON debt_txn (txn_date, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS debt_txn_status_idx
  ON debt_txn (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS debt_txn_type_idx
  ON debt_txn (txn_type)
  WHERE deleted_at IS NULL;

-- งวดเงินเดือน: ใช้เฉพาะ installment
CREATE INDEX IF NOT EXISTS debt_txn_month_idx
  ON debt_txn (payroll_month_date)
  WHERE deleted_at IS NULL AND txn_type = 'installment';

-- สะดวกต่อการ join พนักงาน/พาเรนต์
CREATE INDEX IF NOT EXISTS debt_txn_emp_idx
  ON debt_txn (employee_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS debt_txn_parent_idx
  ON debt_txn (parent_id)
  WHERE deleted_at IS NULL;

-- ====================================
-- 4) ทริกเกอร์คุมกติกา
-- ====================================

-- 4.1 updated_at อัตโนมัติ
DROP TRIGGER IF EXISTS tg_debt_txn_set_updated ON debt_txn;
CREATE TRIGGER tg_debt_txn_set_updated
BEFORE UPDATE ON debt_txn
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 4.2 ตรวจ parent/พนักงาน/ประเภท ก่อน INSERT/UPDATE
CREATE OR REPLACE FUNCTION debt_txn_parent_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_parent_type debt_txn_type;
  v_parent_emp  UUID;
  v_parent_status debt_status;
BEGIN
  IF NEW.txn_type = 'installment' THEN
    IF NEW.parent_id IS NULL THEN
      RAISE EXCEPTION 'installment must have parent_id';
    END IF;

    SELECT t.txn_type, t.employee_id, t.status
      INTO v_parent_type, v_parent_emp, v_parent_status
    FROM debt_txn t
    WHERE t.id = NEW.parent_id;

    IF v_parent_type IS NULL THEN
      RAISE EXCEPTION 'parent_id % not found', NEW.parent_id;
    END IF;
    IF v_parent_type NOT IN ('loan','other') THEN
      RAISE EXCEPTION 'parent must be loan/other (got %)', v_parent_type;
    END IF;
    IF v_parent_emp <> NEW.employee_id THEN
      RAISE EXCEPTION 'parent and installment must belong to the same employee';
    END IF;

    -- เงื่อนไขธุรกิจ: แนะนำให้สร้างผ่อนชำระเฉพาะเมื่อ parent ยัง pending
    IF TG_OP = 'INSERT' AND v_parent_status <> 'pending' THEN
      RAISE EXCEPTION 'cannot create installment when parent is not pending (current: %)', v_parent_status;
    END IF;
  ELSE
    -- loan/other/repayment ต้องไม่มี parent
    IF NEW.parent_id IS NOT NULL THEN
      RAISE EXCEPTION '% cannot have parent_id', NEW.txn_type;
    END IF;
  END IF;

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS tg_debt_txn_parent_guard_biu ON debt_txn;
CREATE TRIGGER tg_debt_txn_parent_guard_biu
BEFORE INSERT OR UPDATE ON debt_txn
FOR EACH ROW
EXECUTE FUNCTION debt_txn_parent_guard();

-- 4.3 บังคับให้ installment ถูกบันทึกด้วยสถานะ 'pending' เสมอ (ตอนสร้าง)
CREATE OR REPLACE FUNCTION debt_txn_installment_force_pending()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.txn_type = 'installment' THEN
    NEW.status := 'pending';
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS tg_debt_txn_installment_force_pending ON debt_txn;
CREATE TRIGGER tg_debt_txn_installment_force_pending
BEFORE INSERT ON debt_txn
FOR EACH ROW
EXECUTE FUNCTION debt_txn_installment_force_pending();

-- 4.4 Guard การแก้ไข/ลบ ตามสถานะ และกติกา parent สำหรับ installment
CREATE OR REPLACE FUNCTION debt_txn_status_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_parent_status debt_status;
  changing_meaningful BOOLEAN := FALSE;
  changing_other BOOLEAN := FALSE;
  allow_status_promote BOOLEAN := FALSE;
BEGIN
  -- ห้ามแก้/ลบ เมื่อเดิมเป็น approved
  IF OLD.status = 'approved' THEN
    IF (ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*)) THEN
      RAISE EXCEPTION 'Approved record cannot be modified or deleted';
    END IF;
  END IF;

  -- ตรวจเฉพาะ installment: แก้ไข/ลบได้เมื่อ parent ยัง pending เท่านั้น
  IF OLD.txn_type = 'installment' THEN
    SELECT status INTO v_parent_status FROM debt_txn WHERE id = OLD.parent_id;

    -- ตรวจลบ (soft delete): เปลี่ยน deleted_at จาก NULL -> NOT NULL
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
      IF v_parent_status <> 'pending' THEN
        RAISE EXCEPTION 'installment can be soft-deleted only when parent is pending (current: %)', v_parent_status;
      END IF;
    END IF;

    -- ตรวจ "แก้ไขค่า" (ยอมให้เปลี่ยนแค่ updated_by; updated_at ถูกตั้งอัตโนมัติ)
    changing_other :=
      (NEW.employee_id        IS DISTINCT FROM OLD.employee_id) OR
      (NEW.txn_date           IS DISTINCT FROM OLD.txn_date) OR
      (NEW.txn_type           IS DISTINCT FROM OLD.txn_type) OR
      (NEW.other_desc         IS DISTINCT FROM OLD.other_desc) OR
      (NEW.amount             IS DISTINCT FROM OLD.amount) OR
      (NEW.reason             IS DISTINCT FROM OLD.reason) OR
      (NEW.payroll_month_date IS DISTINCT FROM OLD.payroll_month_date) OR
      (NEW.parent_id          IS DISTINCT FROM OLD.parent_id) OR
      (NEW.deleted_at         IS DISTINCT FROM OLD.deleted_at) OR
      (NEW.deleted_by         IS DISTINCT FROM OLD.deleted_by);

    changing_meaningful :=
      changing_other OR
      (NEW.status             IS DISTINCT FROM OLD.status);

    -- อนุญาตให้เปลี่ยนสถานะจาก pending -> approved แม้ parent จะไม่ pending แล้ว
    allow_status_promote :=
      (OLD.status = 'pending'
        AND NEW.status = 'approved'
        AND v_parent_status = 'approved'
        AND NOT changing_other);

    IF changing_meaningful AND v_parent_status <> 'pending' THEN
      IF NOT allow_status_promote THEN
        RAISE EXCEPTION 'installment can be modified only when parent is pending (current: %)', v_parent_status;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS tg_debt_txn_status_guard_bu ON debt_txn;
CREATE TRIGGER tg_debt_txn_status_guard_bu
BEFORE UPDATE ON debt_txn
FOR EACH ROW
EXECUTE FUNCTION debt_txn_status_guard();

-- 4.5 ฟังก์ชัน: cascade soft delete ลูก (เฉพาะ installment ที่ยัง pending)
CREATE OR REPLACE FUNCTION debt_txn_cascade_soft_delete_children()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- ทำงานเฉพาะ parent (loan/other) ที่เพิ่งถูก soft delete
  IF TG_OP = 'UPDATE'
    AND OLD.deleted_at IS NULL
    AND NEW.deleted_at IS NOT NULL
    AND NEW.txn_type IN ('loan','other')
  THEN
    -- กันเคส: มีลูกที่ยัง active แต่สถานะไม่ใช่ pending -> บล็อก
    IF EXISTS (
      SELECT 1
      FROM debt_txn c
      WHERE c.parent_id = NEW.id
        AND c.txn_type = 'installment'
        AND c.deleted_at IS NULL
        AND c.status <> 'pending'
    ) THEN
      RAISE EXCEPTION
        'Cannot soft-delete parent while some child installments are not pending';
    END IF;

    -- soft delete ลูกทุกแถวที่ยัง pending
    UPDATE debt_txn c
      SET deleted_at = NEW.deleted_at,
          deleted_by = NEW.deleted_by,
          updated_at = now(),
          updated_by = NEW.updated_by
    WHERE c.parent_id = NEW.id
      AND c.txn_type = 'installment'
      AND c.deleted_at IS NULL
      AND c.status = 'pending';
  END IF;

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS tg_debt_txn_cascade_soft_delete_children ON debt_txn;
CREATE TRIGGER tg_debt_txn_cascade_soft_delete_children
AFTER UPDATE ON debt_txn
FOR EACH ROW
EXECUTE FUNCTION debt_txn_cascade_soft_delete_children();

-- ให้คอยเฝ้าดูว่ามีการอนุมัติหนี้ (เพิ่มยอด) หรือการชำระเงิน (ลดยอด) หรือไม่ แล้วไปอัปเดตใน payroll_accumulation ทันที
CREATE OR REPLACE FUNCTION public.sync_loan_balance_to_accumulation() RETURNS trigger AS $$
DECLARE
  v_diff NUMERIC(14,2) := 0;
  v_approved_now BOOLEAN := FALSE;
BEGIN
  -- ทำงานเฉพาะเมื่อสถานะเป็น 'approved' (ตอน INSERT) หรือเพิ่งเปลี่ยนเป็น 'approved' (ตอน UPDATE)
  IF TG_OP = 'INSERT' THEN
    v_approved_now := (NEW.status = 'approved');
  ELSE
    v_approved_now := (NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved'));
  END IF;

  IF v_approved_now THEN
    
    -- กรณี: อนุมัติเงินกู้/ตั้งหนี้ (ยอดหนี้เพิ่ม +)
    IF NEW.txn_type IN ('loan', 'other') THEN
      v_diff := NEW.amount;
      
    -- กรณี: อนุมัติการคืนเงิน/จ่ายค่างวด (ยอดหนี้ลด -)
    ELSIF NEW.txn_type IN ('repayment', 'installment') THEN
      v_diff := -NEW.amount;
    END IF;

    -- Upsert ลงใน payroll_accumulation
    INSERT INTO payroll_accumulation (
      employee_id, accum_type, accum_year, amount, updated_by, updated_at
    )
    VALUES (
      NEW.employee_id, 
      'loan_outstanding', 
      NULL,        -- ปีเป็น NULL เสมอ
      v_diff,      -- ค่าเริ่มต้น (ถ้าเพิ่งสร้าง)
      NEW.updated_by, 
      now()
    )
    ON CONFLICT (employee_id, accum_type, COALESCE(accum_year, -1))
    DO UPDATE SET
      amount = payroll_accumulation.amount + EXCLUDED.amount, -- บวก/ลบ ยอดเข้าไป
      updated_at = now(),
      updated_by = EXCLUDED.updated_by;
      
  END IF;

  -- (Optional) กรณี Revert จาก Approved กลับไป Pending (ถ้ามี Flow นี้) ต้องทำกลับกัน
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ผูก Trigger
DROP TRIGGER IF EXISTS tg_sync_loan_balance ON public.debt_txn;

CREATE TRIGGER tg_sync_loan_balance
AFTER INSERT OR UPDATE ON public.debt_txn
FOR EACH ROW
EXECUTE FUNCTION public.sync_loan_balance_to_accumulation();
