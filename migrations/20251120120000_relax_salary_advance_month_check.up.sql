-- Allow salary advance to be requested for a different payroll month
ALTER TABLE salary_advance
  DROP CONSTRAINT IF EXISTS salary_advance_date_in_month_ck;
