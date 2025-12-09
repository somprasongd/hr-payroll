INSERT INTO payroll_config (
  effective_daterange,
  hourly_rate, ot_hourly_rate,
  attendance_bonus_no_late, attendance_bonus_no_leave,
  housing_allowance, water_rate_per_unit, electricity_rate_per_unit,
  internet_fee_monthly,
  social_security_rate_employee, social_security_rate_employer, social_security_wage_cap,
  status, created_by, updated_by
) VALUES (
  daterange('2025-01-01'::date, NULL, '[)'),
  70.00, 70.00,
  500.00, 1000.00,
  1000.00, 10.00, 6.00,
  80.00,
  0.05, 0.05, 15000.00,         -- 5% ทั้งลูกจ้างและนายจ้าง (กำหนดตามจริงได้)
  'active', 1, 1
);

INSERT INTO payroll_config (
  effective_daterange,
  hourly_rate, ot_hourly_rate,
  attendance_bonus_no_late, attendance_bonus_no_leave,
  housing_allowance, water_rate_per_unit, electricity_rate_per_unit,
  internet_fee_monthly,
  social_security_rate_employee, social_security_rate_employer, social_security_wage_cap,
  status
) VALUES (
  daterange('2025-10-01'::date, NULL, '[)'),
  75.00, 90.00,   -- ตัวอย่างปรับค่า
  600.00, 1200.00,
  1200.00, 11.00, 6.50,
  85.00,
  0.05, 0.05, 15000.00,
  'active', 1, 1
);
-- ทริกเกอร์จะปิดเวอร์ชันก่อนหน้าอัตโนมัติให้สิ้นสุด 2025-10-01

-- ดึงค่าที่ใช้งานจริงตามเดือนนั้น
SELECT (get_effective_payroll_config('2025-09-01')).*
