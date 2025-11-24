-- บันทึก (INSERT)
INSERT INTO worklog_ft (
  employee_id, entry_type, work_date, quantity,
  status, created_by, updated_by
) VALUES (
  $1,        -- users.id ของพนักงาน
  $2,        -- 'late' | 'leave_day' | 'leave_double' | 'leave_hours' | 'ot'
  $3::date,  -- วันที่
  $4::numeric,
  'pending',
  $5,        -- actor user id
  $6
)
RETURNING id;

-- อนุมัติ (เปลี่ยนเป็น approved)
UPDATE worklog_ft
SET status = 'approved', updated_by = $actor
WHERE id = $pid AND deleted_at IS NULL
RETURNING id, status, updated_at, updated_by;

-- ลบแบบ soft delete (อนุญาตเฉพาะ pending)
UPDATE worklog_ft
SET deleted_at = now(), deleted_by = $actor
WHERE id = $pid
  AND deleted_at IS NULL
  AND status = 'pending'
RETURNING id, deleted_at, deleted_by;

-- คิวรี่ รายการที่ “ไม่ลบ”
SELECT *
FROM worklog_ft
WHERE deleted_at IS NULL
ORDER BY work_date DESC, id DESC
LIMIT $limit OFFSET $offset;

-- คิวรี่ ตามช่วงวันที่ (รวม “ไม่ลบ”)
SELECT *
FROM worklog_ft
WHERE deleted_at IS NULL
  AND work_date >= $from::date
  AND work_date <= $to::date
ORDER BY work_date, id;

-- คิวรี่ ตามประเภท
SELECT *
FROM worklog_ft
WHERE deleted_at IS NULL
  AND entry_type = $type;    -- หรือ IN ($1,$2,...)

-- คิวรี่ ตามสถานะ
SELECT *
FROM worklog_ft
WHERE deleted_at IS NULL
  AND status = $status;      -- 'pending' | 'approved'

-- คิวรี่ ต่อพนักงาน + ช่วงวันที่ + สถานะ
SELECT *
FROM worklog_ft
WHERE deleted_at IS NULL
  AND employee_id = $emp
  AND work_date BETWEEN $from::date AND $to::date
  AND status = $status
ORDER BY work_date, id;

-- สรุปยอด แยกตามประเภท
-- 1) รวมทั้งระบบ แยกตามประเภท
-- รวมยอดต่อประเภท (คิด leave_double = x2)
SELECT
  entry_type,
  SUM(CASE WHEN entry_type = 'leave_double' THEN quantity * 2 ELSE quantity END) AS total_units,
  COUNT(*) AS entries
FROM worklog_ft
WHERE deleted_at IS NULL
  AND work_date >= $1::date
  AND work_date <  ($2::date + INTERVAL '1 day')  -- inclusive ถึง $2
GROUP BY entry_type
ORDER BY entry_type;

-- 2) รวม “ต่อพนักงาน” และ “ต่อประเภท”
SELECT
  employee_id,
  entry_type,
  SUM(CASE WHEN entry_type = 'leave_double' THEN quantity * 2 ELSE quantity END) AS total_units
FROM worklog_ft
WHERE deleted_at IS NULL
  AND work_date >= $1::date
  AND work_date <  ($2::date + INTERVAL '1 day')
GROUP BY employee_id, entry_type
ORDER BY employee_id, entry_type;

-- 3) แบบ pivot เป็นคอลัมน์ (อ่านง่ายเวลาออกรายงานต่อพนักงาน)
SELECT
  employee_id,
  SUM(quantity) FILTER (WHERE entry_type = 'late')        AS late_minutes,
  SUM(quantity) FILTER (WHERE entry_type = 'leave_day')   AS leave_days,
  SUM(CASE WHEN entry_type = 'leave_double' THEN quantity * 2 ELSE 0 END) AS leave_days_double_equiv,
  SUM(quantity) FILTER (WHERE entry_type = 'leave_hours') AS leave_hours,
  SUM(quantity) FILTER (WHERE entry_type = 'ot')          AS ot_hours
FROM worklog_ft
WHERE deleted_at IS NULL
  AND work_date >= $1::date
  AND work_date <  ($2::date + INTERVAL '1 day')
GROUP BY employee_id
ORDER BY employee_id;

-- 4) รวม “ต่อวัน” แล้วแยกตามประเภท (สำหรับกราฟรายวัน)
SELECT
  work_date,
  entry_type,
  SUM(CASE WHEN entry_type = 'leave_double' THEN quantity * 2 ELSE quantity END) AS total_units
FROM worklog_ft
WHERE deleted_at IS NULL
  AND work_date >= $1::date
  AND work_date <  ($2::date + INTERVAL '1 day')
GROUP BY work_date, entry_type
ORDER BY work_date, entry_type;

-- 5) เพิ่มตัวกรอง “ประเภท/สถานะ” แบบเลือกได้
SELECT
  entry_type,
  SUM(CASE WHEN entry_type = 'leave_double' THEN quantity * 2 ELSE quantity END) AS total_units
FROM worklog_ft
WHERE deleted_at IS NULL
  AND ($3::approval_status IS NULL OR status = $3)   -- $3 เป็น 'pending' | 'approved' | NULL
  AND ($4::work_entry_type IS NULL OR entry_type = $4)
  AND work_date >= $1::date
  AND work_date <  ($2::date + INTERVAL '1 day')
GROUP BY entry_type
ORDER BY entry_type;
