-- Fix PT Worklog Overnight Shifts (Both Morning and Evening)
-- 1. Drop constraints and generated columns that enforce out > in
-- 2. Re-create generated columns with overnight support
-- 3. Re-add constraints allowing overnight

-- 1. Drop old constraints and columns
ALTER TABLE worklog_pt DROP CONSTRAINT IF EXISTS worklog_pt_evening_pair;
ALTER TABLE worklog_pt DROP CONSTRAINT IF EXISTS worklog_pt_morning_pair;

ALTER TABLE worklog_pt DROP COLUMN IF EXISTS total_hours;
ALTER TABLE worklog_pt DROP COLUMN IF EXISTS total_minutes;
ALTER TABLE worklog_pt DROP COLUMN IF EXISTS evening_minutes;
ALTER TABLE worklog_pt DROP COLUMN IF EXISTS morning_minutes;

-- 2. Re-create morning_minutes with overnight support
ALTER TABLE worklog_pt ADD COLUMN morning_minutes INT
GENERATED ALWAYS AS (
  CASE
    WHEN morning_in IS NOT NULL AND morning_out IS NOT NULL THEN
       CASE
         WHEN morning_out >= morning_in THEN (EXTRACT(EPOCH FROM (morning_out - morning_in)) / 60)::INT
         ELSE (EXTRACT(EPOCH FROM (morning_out - morning_in + INTERVAL '24 hours')) / 60)::INT
       END
    ELSE 0
  END
) STORED;

-- 3. Re-create evening_minutes with overnight support
ALTER TABLE worklog_pt ADD COLUMN evening_minutes INT
GENERATED ALWAYS AS (
  CASE
    WHEN evening_in IS NOT NULL AND evening_out IS NOT NULL THEN
       CASE
         WHEN evening_out >= evening_in THEN (EXTRACT(EPOCH FROM (evening_out - evening_in)) / 60)::INT
         ELSE (EXTRACT(EPOCH FROM (evening_out - evening_in + INTERVAL '24 hours')) / 60)::INT
       END
    ELSE 0
  END
) STORED;

-- 4. Re-create total_minutes
ALTER TABLE worklog_pt ADD COLUMN total_minutes INT
GENERATED ALWAYS AS (
  COALESCE(
    CASE
      WHEN morning_in IS NOT NULL AND morning_out IS NOT NULL THEN
         CASE
           WHEN morning_out >= morning_in THEN (EXTRACT(EPOCH FROM (morning_out - morning_in)) / 60)::INT
           ELSE (EXTRACT(EPOCH FROM (morning_out - morning_in + INTERVAL '24 hours')) / 60)::INT
         END
      ELSE 0
    END, 0
  )
  +
  COALESCE(
    CASE
      WHEN evening_in IS NOT NULL AND evening_out IS NOT NULL THEN
         CASE
           WHEN evening_out >= evening_in THEN (EXTRACT(EPOCH FROM (evening_out - evening_in)) / 60)::INT
           ELSE (EXTRACT(EPOCH FROM (evening_out - evening_in + INTERVAL '24 hours')) / 60)::INT
         END
      ELSE 0
    END, 0
  )
) STORED;

-- 5. Re-create total_hours
ALTER TABLE worklog_pt ADD COLUMN total_hours NUMERIC(10,2)
GENERATED ALWAYS AS (
  ROUND((
    COALESCE(
      CASE
        WHEN morning_in IS NOT NULL AND morning_out IS NOT NULL THEN
           CASE
             WHEN morning_out >= morning_in THEN (EXTRACT(EPOCH FROM (morning_out - morning_in)) / 60)::INT
             ELSE (EXTRACT(EPOCH FROM (morning_out - morning_in + INTERVAL '24 hours')) / 60)::INT
           END
        ELSE 0
      END, 0
    )
    +
    COALESCE(
      CASE
        WHEN evening_in IS NOT NULL AND evening_out IS NOT NULL THEN
           CASE
             WHEN evening_out >= evening_in THEN (EXTRACT(EPOCH FROM (evening_out - evening_in)) / 60)::INT
             ELSE (EXTRACT(EPOCH FROM (evening_out - evening_in + INTERVAL '24 hours')) / 60)::INT
           END
        ELSE 0
      END, 0
    )
  )::numeric / 60.0, 2)
) STORED;
