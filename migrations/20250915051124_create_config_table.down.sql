/* =======================
  Roll‑back – Payroll config
   ======================= */

-- 1  Drop the two triggers that were added to payroll_config
DROP TRIGGER IF EXISTS tg_payroll_config_set_updated  ON payroll_config;
DROP TRIGGER IF EXISTS tg_payroll_config_auto_close_prev ON payroll_config;
DROP TRIGGER IF EXISTS tg_payroll_config_guard_create ON payroll_config;

-- 2  Drop the trigger / helper functions that were created
--      (only those defined in this script – do NOT drop set_updated_at if it lives elsewhere)
DROP FUNCTION IF EXISTS payroll_config_auto_close_prev() CASCADE;
DROP FUNCTION IF EXISTS get_effective_payroll_config(DATE) CASCADE;
DROP FUNCTION IF EXISTS payroll_config_guard_create_policy() CASCADE;

-- 3  Drop the main table – this also removes its indexes, constraints, and any dependent triggers
DROP TABLE IF EXISTS payroll_config CASCADE;

-- 4  Drop the sequence that was used for version_no
DROP SEQUENCE IF EXISTS payroll_config_version_seq;

-- 5 Drop the custom ENUM type
DROP TYPE IF EXISTS config_status;

-- 6  (Optional) Drop the btree_gist extension if you know no other objects depend on it
--      COMMENT:  If other schemas still use this extension, skip the line below
-- DROP EXTENSION IF EXISTS btree_gist;