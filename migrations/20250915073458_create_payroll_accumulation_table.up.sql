-- กำหนด employer ไว้ก่อน ยังไม่ได้ใช้
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'accum_type') THEN
    -- sso | tax | income | pf
    CREATE DOMAIN accum_type AS TEXT
      CONSTRAINT accum_type_chk
      CHECK (VALUE IN ('tax', 'sso', 'sso_employer', 'income', 'pf', 'pf_employer', 'loan_outstanding'));
  END IF;
END$$;

-- ===== payroll_accumulation (ยอดเงินสะสม) =====
CREATE TABLE IF NOT EXISTS payroll_accumulation (
  id           UUID PRIMARY KEY DEFAULT uuidv7(),
  employee_id  UUID NOT NULL REFERENCES employees(id),
  accum_type   accum_type NOT NULL,     -- sso | tax | income | pf
  accum_year   INTEGER NULL,            -- มีค่า = รายปี (sso/tax/income), NULL = ตลอดชีพ (pf)
  amount       NUMERIC(14,2) NOT NULL DEFAULT 0.00,

  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID NOT NULL REFERENCES users(id),

  CONSTRAINT payroll_accum_year_ck
    CHECK (
      (accum_type IN ('tax', 'sso', 'sso_employer', 'income') AND accum_year IS NOT NULL)
      OR
      (accum_type IN ('pf', 'pf_employer', 'loan_outstanding') AND accum_year IS NULL)
    )
);

-- Index เพื่อให้ค้นหาเร็วและห้ามข้อมูลซ้ำ (Unique)
CREATE UNIQUE INDEX IF NOT EXISTS payroll_accum_unique_uk
  ON payroll_accumulation (employee_id, accum_type, COALESCE(accum_year, -1));

DROP TRIGGER IF EXISTS tg_payroll_accum_set_updated ON payroll_accumulation;
CREATE TRIGGER tg_payroll_accum_set_updated
BEFORE UPDATE ON payroll_accumulation
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
