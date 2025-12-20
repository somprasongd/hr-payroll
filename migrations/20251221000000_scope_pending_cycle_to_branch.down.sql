-- =========================================
-- ROLLBACK: Scope Pending Cycle Constraints to Branch-level
-- Restore to global pending constraints
-- =========================================

-- =========================================
-- 1) RESTORE UNIQUE INDEXES (back to global)
-- =========================================

-- salary_raise_cycle: restore global pending
DROP INDEX IF EXISTS salary_raise_cycle_pending_branch_uk;
CREATE UNIQUE INDEX salary_raise_cycle_pending_one_uk
  ON salary_raise_cycle ((1))
  WHERE status = 'pending' AND deleted_at IS NULL;

-- bonus_cycle: restore global pending
DROP INDEX IF EXISTS bonus_cycle_pending_branch_uk;
CREATE UNIQUE INDEX bonus_cycle_pending_one_uk
  ON bonus_cycle ((1))
  WHERE status = 'pending' AND deleted_at IS NULL;

-- bonus_cycle: restore global approved month
DROP INDEX IF EXISTS bonus_cycle_month_branch_approved_uk;
CREATE UNIQUE INDEX bonus_cycle_month_approved_uk
  ON bonus_cycle (payroll_month_date)
  WHERE status = 'approved' AND deleted_at IS NULL;

-- =========================================
-- 2) RESTORE TRIGGER SYNC FUNCTIONS (back to global LIMIT 1)
-- =========================================

-- 2.1) worklog_ft_sync_salary_raise_item
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
  SELECT id, period_start_date, period_end_date
    INTO v_cycle_id, v_start, v_end
  FROM salary_raise_cycle
  WHERE status = 'pending' AND deleted_at IS NULL
  LIMIT 1;

  IF v_cycle_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
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
      PERFORM salary_raise_item_recompute_snapshot(v_cycle_id, v_emp);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
      IF v_old_date BETWEEN v_start AND v_end THEN
        PERFORM salary_raise_item_recompute_snapshot(v_cycle_id, OLD.employee_id);
      END IF;
      IF v_new_date BETWEEN v_start AND v_end THEN
        PERFORM salary_raise_item_recompute_snapshot(v_cycle_id, NEW.employee_id);
      END IF;
      RETURN COALESCE(NEW, OLD);
    END IF;
    IF (v_new_date BETWEEN v_start AND v_end)
      OR (v_old_date BETWEEN v_start AND v_end)
      OR (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at)
      OR (NEW.status     IS DISTINCT FROM OLD.status)
      OR (NEW.entry_type IS DISTINCT FROM OLD.entry_type)
      OR (NEW.quantity   IS DISTINCT FROM OLD.quantity)
    THEN
      PERFORM salary_raise_item_recompute_snapshot(v_cycle_id, v_emp);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF v_old_date BETWEEN v_start AND v_end THEN
      PERFORM salary_raise_item_recompute_snapshot(v_cycle_id, v_emp);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END$$;

-- 2.2) salary_raise_sync_item_on_employee_pay
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

-- 2.3) worklog_ft_sync_bonus_item
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
  SELECT id, period_start_date, period_end_date
    INTO v_cycle_id, v_start, v_end
  FROM bonus_cycle
  WHERE status = 'pending' AND deleted_at IS NULL
  LIMIT 1;

  IF v_cycle_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
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
      RETURN COALESCE(NEW, OLD);
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

  RETURN COALESCE(NEW, OLD);
END$$;

-- 2.4) bonus_sync_item_on_employee_pay
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

-- =========================================
-- 3) RESTORE salary_raise_cycle_after_insert (company only)
-- =========================================
CREATE OR REPLACE FUNCTION salary_raise_cycle_after_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO salary_raise_item (
    cycle_id, employee_id, company_id, tenure_days,
    current_salary, current_sso_wage,
    raise_percent, raise_amount, new_sso_wage,
    late_minutes, leave_days, leave_double_days, leave_hours, ot_hours,
    created_by, updated_by
  )
  SELECT
    NEW.id, e.id, NEW.company_id,
    (DATE(NEW.created_at) - e.employment_start_date) AS tenure_days,
    e.base_pay_amount, e.sso_declared_wage,
    0.00, 0.00,
    e.sso_declared_wage,
    COALESCE((SELECT SUM(w.quantity)::INT FROM worklog_ft w WHERE w.employee_id = e.id AND w.entry_type = 'late' AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date AND w.deleted_at IS NULL AND w.status IN ('pending','approved')),0),
    COALESCE((SELECT SUM(w.quantity)::NUMERIC(6,2) FROM worklog_ft w WHERE w.employee_id = e.id AND w.entry_type = 'leave_day' AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date AND w.deleted_at IS NULL AND w.status IN ('pending','approved')),0.00),
    COALESCE((SELECT SUM(w.quantity)::NUMERIC(6,2) FROM worklog_ft w WHERE w.employee_id = e.id AND w.entry_type = 'leave_double' AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date AND w.deleted_at IS NULL AND w.status IN ('pending','approved')),0.00),
    COALESCE((SELECT SUM(w.quantity)::NUMERIC(6,2) FROM worklog_ft w WHERE w.employee_id = e.id AND w.entry_type = 'leave_hours' AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date AND w.deleted_at IS NULL AND w.status IN ('pending','approved')),0.00),
    COALESCE((SELECT SUM(w.quantity)::NUMERIC(6,2) FROM worklog_ft w WHERE w.employee_id = e.id AND w.entry_type = 'ot' AND w.work_date BETWEEN NEW.period_start_date AND NEW.period_end_date AND w.deleted_at IS NULL AND w.status IN ('pending','approved')),0.00),
    NEW.created_by, NEW.updated_by
  FROM employees e
  JOIN employee_type et ON et.id = e.employee_type_id
  WHERE et.code = 'full_time'
    AND e.employment_end_date IS NULL
    AND e.deleted_at IS NULL
    AND e.company_id = NEW.company_id;

  RETURN NEW;
END$$;

-- =========================================
-- 4) RESTORE RLS POLICIES (company only)
-- =========================================
DROP POLICY IF EXISTS tenant_isolation_salary_raise_cycle ON salary_raise_cycle;
CREATE POLICY tenant_isolation_salary_raise_cycle ON salary_raise_cycle
  USING (tenant_company_matches(company_id));

DROP POLICY IF EXISTS tenant_isolation_salary_raise_item ON salary_raise_item;
CREATE POLICY tenant_isolation_salary_raise_item ON salary_raise_item
  USING (tenant_company_matches(company_id));

-- Done
