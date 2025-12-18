-- =========================================
-- Align payroll_org_profile and payroll_config versioning 
-- and triggers with per-company scoping
-- =========================================

-- =========================================
-- PART 1: payroll_org_profile
-- =========================================

-- Allow duplicate version numbers across companies while keeping per-company uniqueness
DROP INDEX IF EXISTS payroll_org_profile_version_uk;
CREATE UNIQUE INDEX IF NOT EXISTS payroll_org_profile_company_version_uk
  ON payroll_org_profile(company_id, version_no);

-- Close previous versions only within the same company
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
    AND p.company_id = NEW.company_id
    AND upper_inf(p.effective_daterange);

  RETURN NEW;
END$$;

-- Apply profiles only to pending runs within the same company
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
    AND pr.company_id = NEW.company_id
    AND NEW.effective_daterange @> pr.payroll_month_date;

  RETURN NEW;
END$$;

-- =========================================
-- PART 2: payroll_config 
-- =========================================

-- Version uniqueness: per-company instead of global
DROP INDEX IF EXISTS payroll_config_version_uk;
CREATE UNIQUE INDEX IF NOT EXISTS payroll_config_company_version_uk
  ON payroll_config(company_id, version_no);

-- No overlap constraint: add company_id scope
ALTER TABLE payroll_config DROP CONSTRAINT IF EXISTS payroll_config_no_overlap;
ALTER TABLE payroll_config
  ADD CONSTRAINT payroll_config_no_overlap
  EXCLUDE USING gist (
    company_id WITH =,
    effective_daterange WITH &&
  )
  WHERE (status = 'active')
  DEFERRABLE INITIALLY DEFERRED;

-- Close previous versions only within the same company
CREATE OR REPLACE FUNCTION payroll_config_auto_close_prev()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  start_date DATE;
BEGIN
  start_date := lower(NEW.effective_daterange);

  UPDATE payroll_config pc
  SET effective_daterange = CASE
        WHEN lower(pc.effective_daterange) < start_date
          THEN daterange(lower(pc.effective_daterange), start_date, '[)')
        ELSE pc.effective_daterange
      END,
      status     = CASE WHEN pc.status = 'active' THEN 'retired' ELSE pc.status END,
      updated_at = now(),
      updated_by = NEW.updated_by
  WHERE pc.id <> NEW.id
    AND pc.company_id = NEW.company_id  -- Only within same company
    AND upper_inf(pc.effective_daterange);

  RETURN NEW;
END$$;

-- Get effective config: scoped to company_id parameter
CREATE OR REPLACE FUNCTION get_effective_payroll_config(
  p_period_month DATE,
  p_company_id UUID DEFAULT NULL
) RETURNS payroll_config LANGUAGE sql AS $$
  SELECT pc.*
  FROM payroll_config pc
  WHERE pc.effective_daterange @> p_period_month
    AND (p_company_id IS NULL OR pc.company_id = p_company_id)
  ORDER BY lower(pc.effective_daterange) DESC, pc.version_no DESC
  LIMIT 1;
$$;
