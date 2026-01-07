-- Revert PT Worklog Overnight Shifts

-- 1. Drop new columns
ALTER TABLE worklog_pt DROP COLUMN IF EXISTS total_hours;
ALTER TABLE worklog_pt DROP COLUMN IF EXISTS total_minutes;
ALTER TABLE worklog_pt DROP COLUMN IF EXISTS evening_minutes;
ALTER TABLE worklog_pt DROP COLUMN IF EXISTS morning_minutes;

-- 2. Restore generated columns (NO overnight support)
ALTER TABLE worklog_pt ADD COLUMN morning_minutes INT
GENERATED ALWAYS AS (
  CASE
    WHEN morning_in IS NOT NULL AND morning_out IS NOT NULL
        AND morning_out > morning_in
    THEN (EXTRACT(EPOCH FROM (morning_out - morning_in)) / 60)::INT
    ELSE 0
  END
) STORED;

ALTER TABLE worklog_pt ADD COLUMN evening_minutes INT
GENERATED ALWAYS AS (
  CASE
    WHEN evening_in IS NOT NULL AND evening_out IS NOT NULL
        AND evening_out > evening_in
    THEN (EXTRACT(EPOCH FROM (evening_out - evening_in)) / 60)::INT
    ELSE 0
  END
) STORED;

ALTER TABLE worklog_pt ADD COLUMN total_minutes INT
GENERATED ALWAYS AS (
  COALESCE(
    CASE
      WHEN morning_in IS NOT NULL AND morning_out IS NOT NULL
          AND morning_out > morning_in
      THEN (EXTRACT(EPOCH FROM (morning_out - morning_in)) / 60)::INT
      ELSE 0
    END, 0
  )
  +
  COALESCE(
    CASE
      WHEN evening_in IS NOT NULL AND evening_out IS NOT NULL
          AND evening_out > evening_in
      THEN (EXTRACT(EPOCH FROM (evening_out - evening_in)) / 60)::INT
      ELSE 0
    END, 0
  )
) STORED;

ALTER TABLE worklog_pt ADD COLUMN total_hours NUMERIC(10,2)
GENERATED ALWAYS AS (
  ROUND((
    COALESCE(
      CASE
        WHEN morning_in IS NOT NULL AND morning_out IS NOT NULL
            AND morning_out > morning_in
        THEN (EXTRACT(EPOCH FROM (morning_out - morning_in)) / 60)::INT
        ELSE 0
      END, 0
    )
    +
    COALESCE(
      CASE
        WHEN evening_in IS NOT NULL AND evening_out IS NOT NULL
            AND evening_out > evening_in
        THEN (EXTRACT(EPOCH FROM (evening_out - evening_in)) / 60)::INT
        ELSE 0
      END, 0
    )
  )::numeric / 60.0, 2)
) STORED;

-- 3. Restore constraints
ALTER TABLE worklog_pt ADD CONSTRAINT worklog_pt_morning_pair CHECK (
  morning_in IS NULL OR morning_out IS NULL OR morning_out > morning_in
);

ALTER TABLE worklog_pt ADD CONSTRAINT worklog_pt_evening_pair CHECK (
  evening_in IS NULL OR evening_out IS NULL OR evening_out > evening_in
);

