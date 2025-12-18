package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
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

type Run struct {
	ID                 uuid.UUID  `db:"id"`
	PayrollMonth       time.Time  `db:"payroll_month_date"`
	PeriodStart        time.Time  `db:"period_start_date"`
	PayDate            time.Time  `db:"pay_date"`
	Status             string     `db:"status"`
	CreatedAt          time.Time  `db:"created_at"`
	UpdatedAt          time.Time  `db:"updated_at"`
	DeletedAt          *time.Time `db:"deleted_at"`
	ApprovedAt         *time.Time `db:"approved_at"`
	ApprovedBy         *uuid.UUID `db:"approved_by"`
	SSORateEmp         float64    `db:"social_security_rate_employee"`
	SSORateEmployer    float64    `db:"social_security_rate_employer"`
	OrgProfileSnapshot []byte     `db:"org_profile_snapshot"`
	BonusYear          *int       `db:"bonus_year"`
	TotalEmployees     int        `db:"total_employees"`
	TotalNetPay        float64    `db:"total_net_pay"`
	TotalIncome        float64    `db:"total_income"`
	TotalDeduction     float64    `db:"total_deduction"`
	TotalTax           float64    `db:"total_tax"`
	TotalSSO           float64    `db:"total_sso"`
	TotalProvidentFund float64    `db:"total_provident_fund"`
}

type RunListResult struct {
	Rows  []Run
	Total int
}

const netPayExpr = `
COALESCE(income_total,0)
  - COALESCE(late_minutes_deduction,0)
  - COALESCE(leave_days_deduction,0)
  - COALESCE(leave_double_deduction,0)
  - COALESCE(leave_hours_deduction,0)
  - COALESCE(sso_month_amount,0)
  - COALESCE(tax_month_amount,0)
  - COALESCE(pf_month_amount,0)
  - COALESCE(water_amount,0)
  - COALESCE(electric_amount,0)
  - COALESCE(internet_amount,0)
  - COALESCE(advance_repay_amount,0)
  - COALESCE(jsonb_sum_value(others_deduction),0)
  - COALESCE(jsonb_sum_value(loan_repayments),0)
`

const deductionExpr = `(COALESCE(income_total,0) - (` + netPayExpr + `))`

func (r Repository) List(ctx context.Context, page, limit int, status string, year *int, month *time.Time) (RunListResult, error) {
	db := r.dbCtx(ctx)
	offset := (page - 1) * limit
	var where []string
	var args []interface{}
	where = append(where, "deleted_at IS NULL")
	if s := strings.TrimSpace(status); s != "" && s != "all" {
		args = append(args, s)
		where = append(where, fmt.Sprintf("status = $%d", len(args)))
	}
	if year != nil {
		args = append(args, *year)
		where = append(where, fmt.Sprintf("EXTRACT(YEAR FROM payroll_month_date) = $%d", len(args)))
	}
	if month != nil {
		monthStart := time.Date(month.Year(), month.Month(), 1, 0, 0, 0, 0, time.UTC)
		args = append(args, monthStart)
		where = append(where, fmt.Sprintf("payroll_month_date = $%d", len(args)))
	}
	whereClause := strings.Join(where, " AND ")
	args = append(args, limit, offset)
	q := fmt.Sprintf(`
SELECT id, payroll_month_date, period_start_date, pay_date, status,
       created_at, updated_at, deleted_at, approved_at, approved_by,
       social_security_rate_employee, social_security_rate_employer,
       COALESCE((SELECT COUNT(1) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_employees,
       COALESCE((SELECT SUM(%s) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_net_pay,
       COALESCE((SELECT SUM(income_total) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_income,
       COALESCE((SELECT SUM(%s) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_deduction,
       COALESCE((SELECT SUM(tax_month_amount) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_tax,
       COALESCE((SELECT SUM(sso_month_amount) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_sso,
       COALESCE((SELECT SUM(pf_month_amount) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_provident_fund
FROM payroll_run
WHERE %s
ORDER BY payroll_month_date DESC
LIMIT $%d OFFSET $%d`, netPayExpr, deductionExpr, whereClause, len(args)-1, len(args))
	rows, err := db.QueryxContext(ctx, q, args...)
	if err != nil {
		return RunListResult{}, err
	}
	defer rows.Close()
	var runs []Run
	for rows.Next() {
		var run Run
		if err := rows.StructScan(&run); err != nil {
			return RunListResult{}, err
		}
		runs = append(runs, run)
	}
	countArgs := args[:len(args)-2]
	countQ := fmt.Sprintf(`SELECT COUNT(1) FROM payroll_run WHERE %s`, whereClause)
	var total int
	if err := db.GetContext(ctx, &total, countQ, countArgs...); err != nil {
		return RunListResult{}, err
	}
	return RunListResult{Rows: runs, Total: total}, nil
}

func (r Repository) Get(ctx context.Context, id uuid.UUID) (*Run, error) {
	db := r.dbCtx(ctx)
	q := fmt.Sprintf(`
SELECT id, payroll_month_date, period_start_date, pay_date, status,
       created_at, updated_at, deleted_at, approved_at, approved_by,
       social_security_rate_employee, social_security_rate_employer,
       org_profile_snapshot,
       (
         SELECT bc.bonus_year
         FROM bonus_cycle bc
         WHERE bc.payroll_month_date = payroll_run.payroll_month_date
           AND bc.deleted_at IS NULL
         ORDER BY CASE bc.status WHEN 'approved' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
                  bc.created_at DESC
         LIMIT 1
       ) AS bonus_year,
       COALESCE((SELECT COUNT(1) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_employees,
       COALESCE((SELECT SUM(%s) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_net_pay,
       COALESCE((SELECT SUM(income_total) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_income,
       COALESCE((SELECT SUM(%s) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_deduction,
       COALESCE((SELECT SUM(tax_month_amount) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_tax,
       COALESCE((SELECT SUM(sso_month_amount) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_sso,
       COALESCE((SELECT SUM(pf_month_amount) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_provident_fund
FROM payroll_run
WHERE id=$1 AND deleted_at IS NULL
LIMIT 1`, netPayExpr, deductionExpr)
	var run Run
	if err := db.GetContext(ctx, &run, q, id); err != nil {
		return nil, err
	}
	return &run, nil
}

func (r Repository) Create(ctx context.Context, run Run, companyID, branchID, actor uuid.UUID) (*Run, error) {
	db := r.dbCtx(ctx)
	const q = `
INSERT INTO payroll_run (
  payroll_month_date, period_start_date, pay_date,
  social_security_rate_employee, social_security_rate_employer,
  status, company_id, branch_id, created_by, updated_by
) VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,$8,$8)
RETURNING id, payroll_month_date, period_start_date, pay_date, status,
          created_at, updated_at, deleted_at, approved_at, approved_by,
          social_security_rate_employee, social_security_rate_employer,
          0 as total_employees, 0 as total_net_pay, 0 as total_income, 0 as total_deduction,
          0 as total_tax, 0 as total_sso, 0 as total_provident_fund`
	var out Run
	if err := db.GetContext(ctx, &out, q,
		run.PayrollMonth, run.PeriodStart, run.PayDate,
		run.SSORateEmp, run.SSORateEmployer,
		companyID, branchID, actor,
	); err != nil {
		return nil, err
	}
	return &out, nil
}

func (r Repository) UpdateStatus(ctx context.Context, id uuid.UUID, status string, payDate *time.Time, actor uuid.UUID) (*Run, error) {
	db := r.dbCtx(ctx)
	args := []interface{}{status, actor, id}
	setPayDate := ""
	if payDate != nil {
		setPayDate = ", pay_date = $4"
		args = []interface{}{status, actor, id, *payDate}
	}
	const base = `
UPDATE payroll_run
SET status=$1, updated_by=$2%s
WHERE id=$3 AND deleted_at IS NULL
RETURNING id, payroll_month_date, period_start_date, pay_date, status,
          created_at, updated_at, deleted_at, approved_at, approved_by,
          social_security_rate_employee, social_security_rate_employer,
          COALESCE((SELECT COUNT(1) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_employees,
          COALESCE((SELECT SUM(%s) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_net_pay,
          COALESCE((SELECT SUM(income_total) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_income,
          COALESCE((SELECT SUM(%s) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_deduction,
          COALESCE((SELECT SUM(tax_month_amount) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_tax,
          COALESCE((SELECT SUM(sso_month_amount) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_sso,
          COALESCE((SELECT SUM(pf_month_amount) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_provident_fund`
	q := fmt.Sprintf(base, setPayDate, netPayExpr, deductionExpr)

	var run Run
	if err := db.GetContext(ctx, &run, q, args...); err != nil {
		return nil, err
	}
	return &run, nil
}

func (r Repository) Approve(ctx context.Context, id uuid.UUID, actor uuid.UUID) (*Run, error) {
	db := r.dbCtx(ctx)
	q := fmt.Sprintf(`
UPDATE payroll_run
SET status='approved', approved_by=$1, approved_at=COALESCE(approved_at, now()), updated_by=$1
WHERE id=$2 AND deleted_at IS NULL AND status <> 'approved'
RETURNING id, payroll_month_date, period_start_date, pay_date, status,
          created_at, updated_at, deleted_at, approved_at, approved_by,
          social_security_rate_employee, social_security_rate_employer,
          COALESCE((SELECT COUNT(1) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_employees,
          COALESCE((SELECT SUM(%s) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_net_pay,
          COALESCE((SELECT SUM(income_total) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_income,
          COALESCE((SELECT SUM(%s) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_deduction,
          COALESCE((SELECT SUM(tax_month_amount) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_tax,
          COALESCE((SELECT SUM(sso_month_amount) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_sso,
          COALESCE((SELECT SUM(pf_month_amount) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_provident_fund`, netPayExpr, deductionExpr)
	var run Run
	if err := db.GetContext(ctx, &run, q, actor, id); err != nil {
		return nil, err
	}
	return &run, nil
}

func (r Repository) SoftDelete(ctx context.Context, id uuid.UUID, actor uuid.UUID) error {
	db := r.dbCtx(ctx)
	const q = `UPDATE payroll_run SET deleted_at=now(), deleted_by=$1 WHERE id=$2 AND deleted_at IS NULL AND status = 'pending'`
	res, err := db.ExecContext(ctx, q, actor, id)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

type Item struct {
	ID                      uuid.UUID  `db:"id"`
	RunID                   uuid.UUID  `db:"run_id"`
	EmployeeID              uuid.UUID  `db:"employee_id"`
	EmployeeName            string     `db:"employee_name"`
	EmployeeTypeName        *string    `db:"employee_type_name"`
	EmployeeTypeCode        string     `db:"employee_type_code"`
	EmployeeNumber          string     `db:"employee_number"`
	PhotoID                 *uuid.UUID `db:"photo_id"`
	DepartmentName          *string    `db:"department_name"`
	PositionName            *string    `db:"position_name"`
	BankName                *string    `db:"bank_name"`
	BankAccount             *string    `db:"bank_account_no"`
	SalaryAmount            float64    `db:"salary_amount"`
	PTHoursWorked           float64    `db:"pt_hours_worked"`
	PTHourlyRate            float64    `db:"pt_hourly_rate"`
	OtHours                 float64    `db:"ot_hours"`
	OtAmount                float64    `db:"ot_amount"`
	BonusAmount             float64    `db:"bonus_amount"`
	LeaveCompensationAmount float64    `db:"leave_compensation_amount"`
	IncomeTotal             float64    `db:"income_total"`
	IncomeAccumPrev         float64    `db:"income_accum_prev"`
	IncomeAccumTotal        float64    `db:"income_accum_total"`
	LeaveDaysQty            float64    `db:"leave_days_qty"`
	LeaveDaysDeduction      float64    `db:"leave_days_deduction"`
	LateMinutesQty          int        `db:"late_minutes_qty"`
	LateMinutesDeduction    float64    `db:"late_minutes_deduction"`
	SsoMonthAmount          float64    `db:"sso_month_amount"`
	TaxMonthAmount          float64    `db:"tax_month_amount"`
	NetPay                  float64    `db:"net_pay"`
	Status                  string     `db:"status"`
	DeductionTotal          float64    `db:"deduction_total"`
	AdvanceAmount           float64    `db:"advance_amount"`
	LoanOutstandingTotal    float64    `db:"loan_outstanding_total"`
	DoctorFee               float64    `db:"doctor_fee"`
	SsoContribute           bool       `db:"sso_contribute"`
	ProvidentFundContrib    bool       `db:"provident_fund_contribute"`
	WithholdTax             bool       `db:"withhold_tax"`
	AllowHousing            bool       `db:"allow_housing"`
	AllowWater              bool       `db:"allow_water"`
	AllowElectric           bool       `db:"allow_electric"`
	AllowInternet           bool       `db:"allow_internet"`
	AllowDoctorFee          bool       `db:"allow_doctor_fee"`
}

type ItemListResult struct {
	Rows  []Item
	Total int
}

func (r Repository) ListItems(ctx context.Context, runID uuid.UUID, page, limit int, search string, employeeTypeCode string) (ItemListResult, error) {
	db := r.dbCtx(ctx)
	offset := (page - 1) * limit
	var where []string
	var args []interface{}
	where = append(where, "run_id = $1")
	args = append(args, runID)
	fullNameExpr := "(pt.name_th || e.first_name || ' ' || e.last_name || COALESCE(' (' || e.nickname || ')', ''))"
	if s := strings.TrimSpace(search); s != "" {
		args = append(args, "%"+s+"%")
		where = append(where, fmt.Sprintf("(%s ILIKE $%d OR e.employee_number ILIKE $%d)", fullNameExpr, len(args), len(args)))
	}
	if employeeTypeCode != "" {
		args = append(args, employeeTypeCode)
		where = append(where, fmt.Sprintf("et.code = $%d", len(args)))
	}
	whereClause := strings.Join(where, " AND ")
	args = append(args, limit, offset)
	q := fmt.Sprintf(`
SELECT pri.id, pri.run_id, pri.employee_id, %s AS employee_name, e.employee_number, et.code AS employee_type_code,
       e.photo_id,
       pri.employee_type_name, pri.department_name, pri.position_name, pri.bank_name, pri.bank_account_no,
       pri.salary_amount, pri.pt_hours_worked, pri.pt_hourly_rate, pri.ot_hours, pri.ot_amount, pri.bonus_amount,
       pri.income_total, pri.income_accum_prev, pri.income_accum_total,
       pri.leave_compensation_amount, pri.leave_days_qty, pri.leave_days_deduction, pri.late_minutes_qty, pri.late_minutes_deduction,
       pri.sso_month_amount, pri.tax_month_amount, (%s) AS net_pay, 'pending' as status,
       (%s) AS deduction_total,
       pri.doctor_fee,
       e.sso_contribute, e.provident_fund_contribute, e.withhold_tax,
       e.allow_housing, e.allow_water, e.allow_electric, e.allow_internet, e.allow_doctor_fee
FROM payroll_run_item pri
JOIN employees e ON e.id = pri.employee_id
LEFT JOIN person_title pt ON pt.id = e.title_id
JOIN employee_type et ON et.id = e.employee_type_id
WHERE %s
ORDER BY CASE et.code WHEN 'full_time' THEN 0 WHEN 'part_time' THEN 1 ELSE 2 END,
         e.employee_number ASC,
         %s ASC
LIMIT $%d OFFSET $%d`, fullNameExpr, netPayExpr, deductionExpr, whereClause, fullNameExpr, len(args)-1, len(args))
	rows, err := db.QueryxContext(ctx, q, args...)
	if err != nil {
		return ItemListResult{}, err
	}
	defer rows.Close()
	var list []Item
	for rows.Next() {
		var it Item
		if err := rows.StructScan(&it); err != nil {
			return ItemListResult{}, err
		}
		list = append(list, it)
	}
	countArgs := args[:len(args)-2]
	countQ := fmt.Sprintf("SELECT COUNT(1) FROM payroll_run_item pri JOIN employees e ON e.id = pri.employee_id LEFT JOIN person_title pt ON pt.id = e.title_id JOIN employee_type et ON et.id = e.employee_type_id WHERE %s", whereClause)
	var total int
	if err := db.GetContext(ctx, &total, countQ, countArgs...); err != nil {
		return ItemListResult{}, err
	}
	return ItemListResult{Rows: list, Total: total}, nil
}

func (r Repository) UpdateItem(ctx context.Context, id uuid.UUID, actor uuid.UUID, fields map[string]interface{}) (*Item, error) {
	db := r.dbCtx(ctx)
	sets := []string{}
	args := []interface{}{}
	i := 1
	for k, v := range fields {
		sets = append(sets, fmt.Sprintf("%s=$%d", k, i))
		args = append(args, v)
		i++
	}
	sets = append(sets, fmt.Sprintf("updated_by=$%d", i))
	args = append(args, actor)
	i++
	args = append(args, id)
	setClause := strings.Join(sets, ",")
	q := fmt.Sprintf(`UPDATE payroll_run_item SET %s WHERE id=$%d RETURNING id, run_id, employee_id,
       (SELECT (pt.name_th || e.first_name || ' ' || e.last_name || COALESCE(' (' || e.nickname || ')', '')) FROM employees e LEFT JOIN person_title pt ON pt.id = e.title_id WHERE e.id = payroll_run_item.employee_id) AS employee_name,
       (SELECT employee_number FROM employees e WHERE e.id = payroll_run_item.employee_id) AS employee_number,
       (SELECT photo_id FROM employees e WHERE e.id = payroll_run_item.employee_id) AS photo_id,
       (SELECT et.code FROM employees e JOIN employee_type et ON et.id = e.employee_type_id WHERE e.id = payroll_run_item.employee_id) AS employee_type_code,
       employee_type_name, department_name, position_name, bank_name, bank_account_no,
       salary_amount, pt_hours_worked, pt_hourly_rate, ot_hours, ot_amount, bonus_amount,
       income_total, income_accum_prev, income_accum_total,
       COALESCE(leave_compensation_amount,0) AS leave_compensation_amount, leave_days_qty, leave_days_deduction, late_minutes_qty, late_minutes_deduction,
       sso_month_amount, tax_month_amount, (%s) AS net_pay, 'pending' as status,
        (%s) AS deduction_total,
        doctor_fee,
        (SELECT sso_contribute FROM employees e WHERE e.id = payroll_run_item.employee_id) AS sso_contribute,
        (SELECT provident_fund_contribute FROM employees e WHERE e.id = payroll_run_item.employee_id) AS provident_fund_contribute,
        (SELECT withhold_tax FROM employees e WHERE e.id = payroll_run_item.employee_id) AS withhold_tax,
        (SELECT allow_housing FROM employees e WHERE e.id = payroll_run_item.employee_id) AS allow_housing,
        (SELECT allow_water FROM employees e WHERE e.id = payroll_run_item.employee_id) AS allow_water,
        (SELECT allow_electric FROM employees e WHERE e.id = payroll_run_item.employee_id) AS allow_electric,
        (SELECT allow_internet FROM employees e WHERE e.id = payroll_run_item.employee_id) AS allow_internet,
        (SELECT allow_doctor_fee FROM employees e WHERE e.id = payroll_run_item.employee_id) AS allow_doctor_fee`, setClause, i, netPayExpr, deductionExpr)
	var it Item
	if err := db.GetContext(ctx, &it, q, args...); err != nil {
		return nil, err
	}
	return &it, nil
}

func (r Repository) GetItem(ctx context.Context, id uuid.UUID) (*Item, error) {
	db := r.dbCtx(ctx)
	q := fmt.Sprintf(`SELECT pri.id, pri.run_id, pri.employee_id, (pt.name_th || e.first_name || ' ' || e.last_name || COALESCE(' (' || e.nickname || ')', '')) AS employee_name, e.employee_number, et.code AS employee_type_code,
       e.photo_id,
       pri.employee_type_name, pri.department_name, pri.position_name, pri.bank_name, pri.bank_account_no,
       pri.salary_amount, pri.pt_hours_worked, pri.pt_hourly_rate, pri.ot_hours, pri.ot_amount, pri.bonus_amount,
       pri.income_total, pri.income_accum_prev, pri.income_accum_total,
       COALESCE(pri.leave_compensation_amount,0) AS leave_compensation_amount, pri.leave_days_qty, pri.leave_days_deduction, pri.late_minutes_qty, pri.late_minutes_deduction,
       pri.sso_month_amount, pri.tax_month_amount, (%s) AS net_pay, 'pending' as status,
       (%s) AS deduction_total,
       pri.advance_amount, pri.loan_outstanding_total,
       pri.doctor_fee,
       e.sso_contribute, e.provident_fund_contribute, e.withhold_tax,
       e.allow_housing, e.allow_water, e.allow_electric, e.allow_internet, e.allow_doctor_fee
FROM payroll_run_item pri
JOIN employees e ON e.id = pri.employee_id
LEFT JOIN person_title pt ON pt.id = e.title_id
JOIN employee_type et ON et.id = e.employee_type_id
WHERE pri.id=$1 LIMIT 1`, netPayExpr, deductionExpr)
	var it Item
	if err := db.GetContext(ctx, &it, q, id); err != nil {
		return nil, err
	}
	return &it, nil
}

type ItemDetail struct {
	Item
	EmployeeTypeID          uuid.UUID `db:"employee_type_id"`
	HousingAllowance        float64   `db:"housing_allowance"`
	AttendanceBonusNoLate   float64   `db:"attendance_bonus_nolate"`
	AttendanceBonusNoLeave  float64   `db:"attendance_bonus_noleave"`
	LeaveDoubleQty          float64   `db:"leave_double_qty"`
	LeaveDoubleDeduction    float64   `db:"leave_double_deduction"`
	LeaveHoursQty           float64   `db:"leave_hours_qty"`
	LeaveHoursDeduction     float64   `db:"leave_hours_deduction"`
	LeaveCompensationAmount float64   `db:"leave_compensation_amount"`
	SsoDeclaredWage         float64   `db:"sso_declared_wage"`
	SsoAccumPrev            float64   `db:"sso_accum_prev"`
	SsoAccumTotal           float64   `db:"sso_accum_total"`
	TaxAccumPrev            float64   `db:"tax_accum_prev"`
	TaxAccumTotal           float64   `db:"tax_accum_total"`
	PFAccumPrev             float64   `db:"pf_accum_prev"`
	PFMonthAmount           float64   `db:"pf_month_amount"`
	PFAccumTotal            float64   `db:"pf_accum_total"`
	AdvanceAmount           float64   `db:"advance_amount"`
	AdvanceRepayAmount      float64   `db:"advance_repay_amount"`
	AdvanceDiffAmount       float64   `db:"advance_diff_amount"`
	LoanOutstandingPrev     float64   `db:"loan_outstanding_prev"`
	LoanOutstandingTotal    float64   `db:"loan_outstanding_total"`
	LoanRepayments          []byte    `db:"loan_repayments"`
	OthersIncome            []byte    `db:"others_income"`
	OthersDeduction         []byte    `db:"others_deduction"`
	WaterAmount             float64   `db:"water_amount"`
	ElectricAmount          float64   `db:"electric_amount"`
	InternetAmount          float64   `db:"internet_amount"`
	WaterMeterPrev          *float64  `db:"water_meter_prev"`
	WaterMeterCurr          *float64  `db:"water_meter_curr"`
	ElectricMeterPrev       *float64  `db:"electric_meter_prev"`
	ElectricMeterCurr       *float64  `db:"electric_meter_curr"`
	WaterRatePerUnit        float64   `db:"water_rate_per_unit"`
	ElectricityRatePerUnit  float64   `db:"electricity_rate_per_unit"`
}

func (r Repository) GetItemDetail(ctx context.Context, id uuid.UUID) (*ItemDetail, error) {
	db := r.dbCtx(ctx)
	q := fmt.Sprintf(`SELECT pri.id, pri.run_id, pri.employee_id,
       (pt.name_th || e.first_name || ' ' || e.last_name || COALESCE(' (' || e.nickname || ')', '')) AS employee_name, e.employee_number, et.code AS employee_type_code,
       e.photo_id,
       pri.employee_type_name, pri.department_name, pri.position_name, pri.bank_name, pri.bank_account_no,
       pri.salary_amount, pri.pt_hours_worked, pri.pt_hourly_rate, pri.ot_hours, pri.ot_amount, pri.bonus_amount,
       pri.income_total, pri.income_accum_prev, pri.income_accum_total,
       COALESCE(pri.leave_compensation_amount,0) AS leave_compensation_amount, pri.leave_days_qty, pri.leave_days_deduction, pri.late_minutes_qty, pri.late_minutes_deduction,
       pri.sso_month_amount, pri.tax_month_amount, (%s) AS net_pay, 'pending' AS status,
       (%s) AS deduction_total,
       pri.employee_type_id,
       pri.housing_allowance, pri.attendance_bonus_nolate, pri.attendance_bonus_noleave,
       pri.pt_hours_worked, pri.pt_hourly_rate,
       pri.leave_double_qty, pri.leave_double_deduction, pri.leave_hours_qty, pri.leave_hours_deduction,
       pri.sso_declared_wage, pri.sso_accum_prev, pri.sso_accum_total,
       pri.tax_accum_prev, pri.tax_accum_total,
       pri.pf_accum_prev, pri.pf_month_amount, pri.pf_accum_total,
       pri.advance_amount, pri.advance_repay_amount, pri.advance_diff_amount,
       pri.loan_outstanding_prev, pri.loan_outstanding_total, pri.loan_repayments,
       COALESCE(pri.others_income, '[]'::jsonb) AS others_income,
       COALESCE(pri.others_deduction, '[]'::jsonb) AS others_deduction,
       pri.water_amount, pri.electric_amount, pri.internet_amount,
       pri.water_meter_prev, pri.water_meter_curr, pri.electric_meter_prev, pri.electric_meter_curr,
       pri.water_rate_per_unit, pri.electricity_rate_per_unit, pri.doctor_fee,
       e.sso_contribute, e.provident_fund_contribute, e.withhold_tax,
       e.allow_housing, e.allow_water, e.allow_electric, e.allow_internet, e.allow_doctor_fee
FROM payroll_run_item pri
JOIN employees e ON e.id = pri.employee_id
LEFT JOIN person_title pt ON pt.id = e.title_id
JOIN employee_type et ON et.id = e.employee_type_id
WHERE pri.id = $1`, netPayExpr, deductionExpr)
	var it ItemDetail
	if err := db.GetContext(ctx, &it, q, id); err != nil {
		return nil, err
	}
	return &it, nil
}

func IsNotFound(err error) bool {
	return errors.Is(err, sql.ErrNoRows)
}
