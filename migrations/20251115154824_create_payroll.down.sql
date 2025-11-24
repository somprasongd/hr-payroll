-- Drop triggers (items)
DROP TRIGGER IF EXISTS tg_payroll_run_item_compute_biu ON payroll_run_item;
DROP TRIGGER IF EXISTS tg_payroll_run_item_guard_biu   ON payroll_run_item;
DROP TRIGGER IF EXISTS tg_payroll_run_item_set_updated ON payroll_run_item;

-- Drop triggers (run)
DROP TRIGGER IF EXISTS tg_payroll_run_guard_update ON payroll_run;
DROP TRIGGER IF EXISTS tg_payroll_run_set_updated  ON payroll_run;
DROP TRIGGER IF EXISTS tg_payroll_run_generate_items     ON payroll_run;
DROP TRIGGER IF EXISTS tg_payroll_run_on_approve_actions ON payroll_run;

-- Drop functions created in UP (safe order)
DROP FUNCTION IF EXISTS payroll_run_item_compute_totals() CASCADE;
DROP FUNCTION IF EXISTS payroll_run_item_guard_edit() CASCADE;
DROP FUNCTION IF EXISTS get_latest_payroll_pay_date() CASCADE;
DROP FUNCTION IF EXISTS payroll_run_guard_update() CASCADE;
DROP FUNCTION IF EXISTS jsonb_sum_value(jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.payroll_run_generate_items() CASCADE;
DROP FUNCTION IF EXISTS public.payroll_run_on_approve_actions() CASCADE;

-- Tables (reverse order)
DROP TABLE IF EXISTS payroll_run_item;
DROP TABLE IF EXISTS payroll_run;

-- Domains (drop only those created by this migration)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_run_status') THEN
    DROP DOMAIN payroll_run_status;
  END IF;
END$$;
