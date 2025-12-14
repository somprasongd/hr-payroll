-- เพิ่มตารางสำหรับเก็บโลโก้ (bytea) และโปรไฟล์หัวสลิปเงินเดือนแบบเวอร์ชัน พร้อม snapshot ลง payroll_run

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ตารางไฟล์โลโก้ (เก็บใน DB)
CREATE TABLE IF NOT EXISTS payroll_org_logo (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes BETWEEN 1 AND 2097152), -- จำกัดขนาด ≤ 2MB
  data BYTEA NOT NULL,
  checksum_md5 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS payroll_org_logo_checksum_uk
  ON payroll_org_logo(checksum_md5);

-- สถานะโปรไฟล์ (ใช้ enum ร่วมกับ config)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'config_status') THEN
    CREATE TYPE config_status AS ENUM ('active','retired');
  END IF;
END$$;

-- ตารางโปรไฟล์หัวสลิปเงินเดือนแบบกำหนดช่วงวันที่มีผล
CREATE TABLE IF NOT EXISTS payroll_org_profile (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  effective_daterange DATERANGE NOT NULL,
  version_no BIGINT GENERATED ALWAYS AS IDENTITY,
  company_name TEXT NOT NULL,
  address_line1 TEXT,
  address_line2 TEXT,
  subdistrict TEXT,
  district TEXT,
  province TEXT,
  postal_code TEXT,
  phone_main TEXT,
  phone_alt TEXT,
  email TEXT,
  tax_id TEXT,
  slip_footer_note TEXT,
  logo_id UUID REFERENCES payroll_org_logo(id) ON DELETE SET NULL,
  status config_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NOT NULL REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS payroll_org_profile_version_uk
  ON payroll_org_profile(version_no);

CREATE INDEX IF NOT EXISTS payroll_org_profile_effective_idx
  ON payroll_org_profile USING gist (effective_daterange)
  WHERE status = 'active';

-- กันช่วง active ทับซ้อน (ปลายเปิด)
ALTER TABLE payroll_org_profile
  ADD CONSTRAINT payroll_org_profile_no_overlap
  EXCLUDE USING gist (
    effective_daterange WITH &&
  )
  WHERE (status = 'active')
  DEFERRABLE INITIALLY DEFERRED;

-- ปิดเวอร์ชันเก่าที่ปลายเปิดเมื่อมีแถวใหม่
CREATE OR REPLACE FUNCTION payroll_org_profile_auto_close_prev()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  start_date DATE;
BEGIN
  start_date := lower(NEW.effective_daterange);

  UPDATE payroll_org_profile p
  SET effective_daterange = CASE
        WHEN lower(p.effective_daterange) < start_date
          THEN daterange(lower(p.effective_daterange), start_date, '[)')
        ELSE p.effective_daterange
      END,
      status     = CASE WHEN p.status = 'active' THEN 'retired' ELSE p.status END,
      updated_at = now(),
      updated_by = NEW.updated_by
  WHERE p.id <> NEW.id
    AND upper_inf(p.effective_daterange);

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS tg_payroll_org_profile_auto_close_prev ON payroll_org_profile;
CREATE TRIGGER tg_payroll_org_profile_auto_close_prev
AFTER INSERT ON payroll_org_profile
FOR EACH ROW
EXECUTE FUNCTION payroll_org_profile_auto_close_prev();

-- ฟังก์ชันหาโปรไฟล์ที่มีผลในงวด
CREATE OR REPLACE FUNCTION get_effective_org_profile(
  p_period_month DATE
) RETURNS payroll_org_profile LANGUAGE sql AS $$
  SELECT p.*
  FROM payroll_org_profile p
  WHERE p.effective_daterange @> p_period_month
  ORDER BY lower(p.effective_daterange) DESC, p.version_no DESC
  LIMIT 1;
$$;

-- เพิ่มคอลัมน์ลง payroll_run สำหรับอ้างอิง/เก็บ snapshot
ALTER TABLE payroll_run
  ADD COLUMN IF NOT EXISTS org_profile_id UUID,
  ADD COLUMN IF NOT EXISTS org_profile_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

-- อัปเดต payroll_run ที่ pending ให้ใช้โปรไฟล์ล่าสุดที่ถูก insert
CREATE OR REPLACE FUNCTION payroll_org_profile_apply_to_pending_runs()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE payroll_run pr
  SET org_profile_id = NEW.id,
      org_profile_snapshot = jsonb_build_object(
        'profile_id', NEW.id,
        'version_no', NEW.version_no,
        'effective_start', lower(NEW.effective_daterange),
        'effective_end', upper(NEW.effective_daterange),
        'company_name', NEW.company_name,
        'address_line1', NEW.address_line1,
        'address_line2', NEW.address_line2,
        'subdistrict', NEW.subdistrict,
        'district', NEW.district,
        'province', NEW.province,
        'postal_code', NEW.postal_code,
        'phone_main', NEW.phone_main,
        'phone_alt', NEW.phone_alt,
        'email', NEW.email,
        'tax_id', NEW.tax_id,
        'slip_footer_note', NEW.slip_footer_note,
        'logo_id', NEW.logo_id
      )
  WHERE pr.status = 'pending'
    AND pr.deleted_at IS NULL
    AND NEW.effective_daterange @> pr.payroll_month_date;

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS tg_payroll_org_profile_apply_to_pending_runs ON payroll_org_profile;
CREATE TRIGGER tg_payroll_org_profile_apply_to_pending_runs
AFTER INSERT ON payroll_org_profile
FOR EACH ROW
EXECUTE FUNCTION payroll_org_profile_apply_to_pending_runs();

-- Seed โปรไฟล์เริ่มต้น (ถ้าไม่มี) และ backfill payroll_run ที่มีอยู่
WITH admin_user AS (
  SELECT id
  FROM users
  WHERE user_role = 'admin' AND deleted_at IS NULL
  ORDER BY created_at
  LIMIT 1
), inserted_logo AS (
  SELECT NULL::UUID AS id
), inserted_profile AS (
  INSERT INTO payroll_org_profile (
    effective_daterange,
    company_name, address_line1, address_line2,
    subdistrict, district, province, postal_code,
    phone_main, phone_alt, email, tax_id, slip_footer_note,
    logo_id, status, created_by, updated_by
  )
  SELECT
    daterange(
      make_date(
        EXTRACT(YEAR FROM current_date)::int,
        EXTRACT(MONTH FROM current_date)::int,
        1
      ),
      NULL::date,
      '[)'
    ),
    'Default Organization',
    'Address line 1',
    NULL,
    NULL, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL, NULL,
    (SELECT id FROM inserted_logo),
    'active',
    id, id
  FROM admin_user
  WHERE NOT EXISTS (SELECT 1 FROM payroll_org_profile)
  RETURNING id, version_no, effective_daterange, company_name, address_line1, address_line2,
            subdistrict, district, province, postal_code, phone_main, phone_alt, email,
            tax_id, slip_footer_note, logo_id
)
UPDATE payroll_run pr
SET org_profile_id = ip.id,
    org_profile_snapshot = jsonb_build_object(
      'profile_id', ip.id,
      'version_no', ip.version_no,
      'effective_start', lower(ip.effective_daterange),
      'effective_end', upper(ip.effective_daterange),
      'company_name', ip.company_name,
      'address_line1', ip.address_line1,
      'address_line2', ip.address_line2,
      'subdistrict', ip.subdistrict,
      'district', ip.district,
      'province', ip.province,
      'postal_code', ip.postal_code,
      'phone_main', ip.phone_main,
      'phone_alt', ip.phone_alt,
      'email', ip.email,
      'tax_id', ip.tax_id,
      'slip_footer_note', ip.slip_footer_note,
      'logo_id', ip.logo_id
    )
FROM inserted_profile ip
WHERE ip.id IS NOT NULL
  AND pr.org_profile_id IS NULL;

-- บังคับให้ต้องมี org_profile_id เสมอหลัง backfill
ALTER TABLE payroll_run
  ALTER COLUMN org_profile_id SET NOT NULL;

-- Trigger ก่อน insert payroll_run เพื่อเลือกโปรไฟล์ + snapshot
CREATE OR REPLACE FUNCTION payroll_run_apply_org_profile()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_profile payroll_org_profile%ROWTYPE;
BEGIN
  IF NEW.org_profile_id IS NULL THEN
    SELECT * INTO v_profile FROM get_effective_org_profile(NEW.payroll_month_date);
  ELSE
    SELECT * INTO v_profile FROM payroll_org_profile WHERE id = NEW.org_profile_id;
  END IF;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'ไม่พบ org profile สำหรับวันที่ %', NEW.payroll_month_date;
  END IF;

  IF NOT (v_profile.effective_daterange @> NEW.payroll_month_date) THEN
    RAISE EXCEPTION 'org profile % ไม่ครอบคลุมเดือนจ่าย %', v_profile.id, NEW.payroll_month_date;
  END IF;

  NEW.org_profile_id := v_profile.id;
  NEW.org_profile_snapshot := jsonb_build_object(
    'profile_id', v_profile.id,
    'version_no', v_profile.version_no,
    'effective_start', lower(v_profile.effective_daterange),
    'effective_end', upper(v_profile.effective_daterange),
    'company_name', v_profile.company_name,
    'address_line1', v_profile.address_line1,
    'address_line2', v_profile.address_line2,
    'subdistrict', v_profile.subdistrict,
    'district', v_profile.district,
    'province', v_profile.province,
    'postal_code', v_profile.postal_code,
    'phone_main', v_profile.phone_main,
    'phone_alt', v_profile.phone_alt,
    'email', v_profile.email,
    'tax_id', v_profile.tax_id,
    'slip_footer_note', v_profile.slip_footer_note,
    'logo_id', v_profile.logo_id
  );

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS tg_payroll_run_apply_org_profile ON payroll_run;
CREATE TRIGGER tg_payroll_run_apply_org_profile
BEFORE INSERT ON payroll_run
FOR EACH ROW
EXECUTE FUNCTION payroll_run_apply_org_profile();
