-- Reinstate constraint: advance_date must fall within payroll_month_date
ALTER TABLE salary_advance
  ADD CONSTRAINT salary_advance_date_in_month_ck
  CHECK (
    advance_date >= date_trunc('month', payroll_month_date)::date
    AND advance_date < (date_trunc('month', payroll_month_date) + INTERVAL '1 month')::date
  );
