package repository

import (
	"context"
	"time"

	"github.com/google/uuid"

	"hrms/shared/common/storage/sqldb/transactor"
)

type Repository struct {
	dbCtx transactor.DBTXContext
}

func NewRepository(dbCtx transactor.DBTXContext) Repository {
	return Repository{dbCtx: dbCtx}
}

type Record struct {
	ID                         uuid.UUID  `db:"id"`
	VersionNo                  int64      `db:"version_no"`
	StartDate                  time.Time  `db:"start_date"`
	EndDate                    *time.Time `db:"end_date"`
	Status                     string     `db:"status"`
	HourlyRate                 float64    `db:"hourly_rate"`
	OtHourlyRate               float64    `db:"ot_hourly_rate"`
	AttendanceBonusNoLate      float64    `db:"attendance_bonus_no_late"`
	AttendanceBonusNoLeave     float64    `db:"attendance_bonus_no_leave"`
	HousingAllowance           float64    `db:"housing_allowance"`
	WaterRatePerUnit           float64    `db:"water_rate_per_unit"`
	ElectricityRatePerUnit     float64    `db:"electricity_rate_per_unit"`
	InternetFeeMonthly         float64    `db:"internet_fee_monthly"`
	SocialSecurityRateEmployee float64    `db:"social_security_rate_employee"`
	SocialSecurityRateEmployer float64    `db:"social_security_rate_employer"`
	Note                       *string    `db:"note"`
	CreatedAt                  time.Time  `db:"created_at"`
	UpdatedAt                  time.Time  `db:"updated_at"`
}

type ListResult struct {
	Rows  []Record
	Total int
}

func (r Repository) List(ctx context.Context, page, limit int) (ListResult, error) {
	db := r.dbCtx(ctx)
	offset := (page - 1) * limit
	if offset < 0 {
		offset = 0
	}

	const baseQuery = `
SELECT
  id,
  COALESCE(version_no, 0) AS version_no,
  lower(effective_daterange) AS start_date,
  NULLIF(upper(effective_daterange), 'infinity') AS end_date,
  status,
  hourly_rate,
  ot_hourly_rate,
  attendance_bonus_no_late,
  attendance_bonus_no_leave,
  housing_allowance,
  water_rate_per_unit,
  electricity_rate_per_unit,
  internet_fee_monthly,
  social_security_rate_employee,
  social_security_rate_employer,
  note,
  created_at,
  updated_at
FROM payroll_config
WHERE effective_daterange IS NOT NULL
ORDER BY version_no DESC
LIMIT $1 OFFSET $2`

	rows, err := db.QueryxContext(ctx, baseQuery, limit, offset)
	if err != nil {
		return ListResult{}, err
	}
	defer rows.Close()

	var items []Record
	for rows.Next() {
		var rec Record
		if err := rows.StructScan(&rec); err != nil {
			return ListResult{}, err
		}
		items = append(items, rec)
	}

	const countQ = `SELECT COUNT(1) FROM payroll_config WHERE effective_daterange IS NOT NULL`
	var total int
	if err := db.GetContext(ctx, &total, countQ); err != nil {
		return ListResult{}, err
	}

	return ListResult{Rows: items, Total: total}, nil
}

func (r Repository) GetEffective(ctx context.Context, date time.Time) (*Record, error) {
	db := r.dbCtx(ctx)
	const q = `
SELECT
  id,
  COALESCE(version_no, 0) AS version_no,
  lower(effective_daterange) AS start_date,
  NULLIF(upper(effective_daterange), 'infinity') AS end_date,
  status,
  hourly_rate,
  ot_hourly_rate,
  attendance_bonus_no_late,
  attendance_bonus_no_leave,
  housing_allowance,
  water_rate_per_unit,
  electricity_rate_per_unit,
  internet_fee_monthly,
  social_security_rate_employee,
  social_security_rate_employer,
  note,
  created_at,
  updated_at
FROM get_effective_payroll_config($1) pc
WHERE pc.id IS NOT NULL
LIMIT 1`
	var rec Record
	if err := db.GetContext(ctx, &rec, q, date); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) Create(ctx context.Context, payload Record, actor uuid.UUID) (*Record, error) {
	db := r.dbCtx(ctx)
	const q = `
INSERT INTO payroll_config (
  effective_daterange,
  hourly_rate,
  ot_hourly_rate,
  attendance_bonus_no_late,
  attendance_bonus_no_leave,
  housing_allowance,
  water_rate_per_unit,
  electricity_rate_per_unit,
  internet_fee_monthly,
  social_security_rate_employee,
  social_security_rate_employer,
  note,
  created_by,
  updated_by
) VALUES (
  daterange($1, NULL, '[)'),
  $2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
)
RETURNING
  id,
  COALESCE(version_no, 0) AS version_no,
  lower(effective_daterange) AS start_date,
  NULLIF(upper(effective_daterange), 'infinity') AS end_date,
  status,
  hourly_rate,
  ot_hourly_rate,
  attendance_bonus_no_late,
  attendance_bonus_no_leave,
  housing_allowance,
  water_rate_per_unit,
  electricity_rate_per_unit,
  internet_fee_monthly,
  social_security_rate_employee,
  social_security_rate_employer,
  note,
  created_at,
  updated_at`

	var rec Record
	err := db.GetContext(ctx, &rec, q,
		payload.StartDate,
		payload.HourlyRate,
		payload.OtHourlyRate,
		payload.AttendanceBonusNoLate,
		payload.AttendanceBonusNoLeave,
		payload.HousingAllowance,
		payload.WaterRatePerUnit,
		payload.ElectricityRatePerUnit,
		payload.InternetFeeMonthly,
		payload.SocialSecurityRateEmployee,
		payload.SocialSecurityRateEmployer,
		payload.Note,
		actor,
		actor,
	)
	if err != nil {
		return nil, err
	}
	return &rec, nil
}
