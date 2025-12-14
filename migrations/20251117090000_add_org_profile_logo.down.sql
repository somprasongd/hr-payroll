-- Rollback: ลบตาราง/ฟังก์ชัน/คอลัมน์ที่เกี่ยวกับ org profile และโลโก้

-- Trigger/ฟังก์ชันบน payroll_run
DROP TRIGGER IF EXISTS tg_payroll_run_apply_org_profile ON payroll_run;
DROP FUNCTION IF EXISTS payroll_run_apply_org_profile();

ALTER TABLE payroll_run
  DROP COLUMN IF EXISTS org_profile_id,
  DROP COLUMN IF EXISTS org_profile_snapshot;

-- ฟังก์ชันเลือกโปรไฟล์
DROP FUNCTION IF EXISTS get_effective_org_profile(DATE);

-- Trigger/ฟังก์ชันปิดเวอร์ชันเก่า + sync payroll_run pending
DROP TRIGGER IF EXISTS tg_payroll_org_profile_apply_to_pending_runs ON payroll_org_profile;
DROP FUNCTION IF EXISTS payroll_org_profile_apply_to_pending_runs();

DROP TRIGGER IF EXISTS tg_payroll_org_profile_auto_close_prev ON payroll_org_profile;
DROP FUNCTION IF EXISTS payroll_org_profile_auto_close_prev();

-- ข้อจำกัด/ดัชนีและตารางโปรไฟล์
ALTER TABLE payroll_org_profile DROP CONSTRAINT IF EXISTS payroll_org_profile_no_overlap;
DROP INDEX IF EXISTS payroll_org_profile_effective_idx;
DROP INDEX IF EXISTS payroll_org_profile_version_uk;
DROP TABLE IF EXISTS payroll_org_profile;

-- ตารางโลโก้
DROP INDEX IF EXISTS payroll_org_logo_checksum_uk;
DROP TABLE IF EXISTS payroll_org_logo;
