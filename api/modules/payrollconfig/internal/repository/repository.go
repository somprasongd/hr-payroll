package repository

import (
	"context"
	"time"

	"github.com/google/uuid"

	"hrms/shared/common/contextx"
	"hrms/shared/common/storage/sqldb/transactor"
)

type Repository struct {
	dbCtx transactor.DBTXContext
}

func NewRepository(dbCtx transactor.DBTXContext) Repository {
	return Repository{dbCtx: dbCtx}
}

type Record struct {
	ID                         uuid.UUID   `db:"id"`
	VersionNo                  int64       `db:"version_no"`
	StartDate                  time.Time   `db:"start_date"`
	EndDate                    *time.Time  `db:"end_date"`
	Status                     string      `db:"status"`
	HourlyRate                 float64     `db:"hourly_rate"`
	OtHourlyRate               float64     `db:"ot_hourly_rate"`
	AttendanceBonusNoLate      float64     `db:"attendance_bonus_no_late"`
	AttendanceBonusNoLeave     float64     `db:"attendance_bonus_no_leave"`
	HousingAllowance           float64     `db:"housing_allowance"`
	WaterRatePerUnit           float64     `db:"water_rate_per_unit"`
	ElectricityRatePerUnit     float64     `db:"electricity_rate_per_unit"`
	InternetFeeMonthly         float64     `db:"internet_fee_monthly"`
	SocialSecurityRateEmployee float64     `db:"social_security_rate_employee"`
	SocialSecurityRateEmployer float64     `db:"social_security_rate_employer"`
	SocialSecurityWageCap      float64     `db:"social_security_wage_cap"`
	TaxApplyStandardExpense    bool        `db:"tax_apply_standard_expense"`
	TaxStandardExpenseRate     float64     `db:"tax_standard_expense_rate"`
	TaxStandardExpenseCap      float64     `db:"tax_standard_expense_cap"`
	TaxApplyPersonalAllowance  bool        `db:"tax_apply_personal_allowance"`
	TaxPersonalAllowanceAmount float64     `db:"tax_personal_allowance_amount"`
	TaxProgressiveBrackets     TaxBrackets `db:"tax_progressive_brackets"`
	WithholdingTaxRateService  float64     `db:"withholding_tax_rate_service"`
	WorkHoursPerDay            float64     `db:"work_hours_per_day"`
	LateRatePerMinute          float64     `db:"late_rate_per_minute"`
	LateGraceMinutes           int         `db:"late_grace_minutes"`
	Note                       *string     `db:"note"`
	CreatedAt                  time.Time   `db:"created_at"`
	UpdatedAt                  time.Time   `db:"updated_at"`
}

type ListResult struct {
	Rows  []Record
	Total int
}

func (r Repository) List(ctx context.Context, tenant contextx.TenantInfo, page, limit int) (ListResult, error) {
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
  social_security_wage_cap,
  tax_apply_standard_expense,
  tax_standard_expense_rate,
  tax_standard_expense_cap,
  tax_apply_personal_allowance,
  tax_personal_allowance_amount,
  tax_progressive_brackets,
  withholding_tax_rate_service,
  work_hours_per_day,
  late_rate_per_minute,
  late_grace_minutes,
  note,
  created_at,
  updated_at
FROM payroll_config
WHERE effective_daterange IS NOT NULL AND company_id = $1
ORDER BY version_no DESC
LIMIT $2 OFFSET $3`

	rows, err := db.QueryxContext(ctx, baseQuery, tenant.CompanyID, limit, offset)
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

	const countQ = `SELECT COUNT(1) FROM payroll_config WHERE effective_daterange IS NOT NULL AND company_id=$1`
	var total int
	if err := db.GetContext(ctx, &total, countQ, tenant.CompanyID); err != nil {
		return ListResult{}, err
	}

	return ListResult{Rows: items, Total: total}, nil
}

func (r Repository) GetEffective(ctx context.Context, tenant contextx.TenantInfo, date time.Time) (*Record, error) {
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
  social_security_wage_cap,
  tax_apply_standard_expense,
  tax_standard_expense_rate,
  tax_standard_expense_cap,
  tax_apply_personal_allowance,
  tax_personal_allowance_amount,
  tax_progressive_brackets,
  withholding_tax_rate_service,
  work_hours_per_day,
  late_rate_per_minute,
  late_grace_minutes,
  note,
  created_at,
  updated_at
FROM payroll_config
WHERE effective_daterange @> $1::date AND company_id=$2
ORDER BY version_no DESC
LIMIT 1`
	var rec Record
	if err := db.GetContext(ctx, &rec, q, date, tenant.CompanyID); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) Create(ctx context.Context, payload Record, companyID, actor uuid.UUID) (*Record, error) {
	db := r.dbCtx(ctx)
	const q = `
WITH next_version AS (
  SELECT
    pg_advisory_xact_lock(hashtext(($21::uuid)::text)::bigint) AS locked,
    COALESCE(MAX(version_no), 0) + 1 AS version_no
  FROM payroll_config
  WHERE company_id = $21::uuid
)
INSERT INTO payroll_config (
  effective_daterange,
  version_no,
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
  social_security_wage_cap,
  tax_apply_standard_expense,
  tax_standard_expense_rate,
  tax_standard_expense_cap,
  tax_apply_personal_allowance,
  tax_personal_allowance_amount,
  tax_progressive_brackets,
  withholding_tax_rate_service,
  work_hours_per_day,
  late_rate_per_minute,
  late_grace_minutes,
  note,
  company_id,
  created_by,
  updated_by
)
SELECT
  daterange($1, NULL, '[)'),
  next_version.version_no,
  $2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$22,$23,$24,$25,$26
FROM next_version
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
  social_security_wage_cap,
  tax_apply_standard_expense,
  tax_standard_expense_rate,
  tax_standard_expense_cap,
  tax_apply_personal_allowance,
  tax_personal_allowance_amount,
  tax_progressive_brackets,
  withholding_tax_rate_service,
  work_hours_per_day,
  late_rate_per_minute,
  late_grace_minutes,
  note,
  company_id,
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
		payload.SocialSecurityWageCap,
		payload.TaxApplyStandardExpense,
		payload.TaxStandardExpenseRate,
		payload.TaxStandardExpenseCap,
		payload.TaxApplyPersonalAllowance,
		payload.TaxPersonalAllowanceAmount,
		payload.TaxProgressiveBrackets,
		payload.WithholdingTaxRateService,
		payload.WorkHoursPerDay,
		payload.LateRatePerMinute,
		payload.LateGraceMinutes,
		payload.Note,
		companyID,
		actor,
	)
	if err != nil {
		return nil, err
	}
	return &rec, nil
}
