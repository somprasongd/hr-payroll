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
	ID              uuid.UUID  `db:"id"`
	PayrollMonth    time.Time  `db:"payroll_month_date"`
	PeriodStart     time.Time  `db:"period_start_date"`
	PayDate         time.Time  `db:"pay_date"`
	Status          string     `db:"status"`
	CreatedAt       time.Time  `db:"created_at"`
	UpdatedAt       time.Time  `db:"updated_at"`
	DeletedAt       *time.Time `db:"deleted_at"`
	ApprovedAt      *time.Time `db:"approved_at"`
	ApprovedBy      *uuid.UUID `db:"approved_by"`
	SSORateEmp      float64    `db:"social_security_rate_employee"`
	SSORateEmployer float64    `db:"social_security_rate_employer"`
	TotalEmployees  int        `db:"total_employees"`
	TotalNetPay     float64    `db:"total_net_pay"`
	TotalIncome     float64    `db:"total_income"`
	TotalDeduction  float64    `db:"total_deduction"`
}

type RunListResult struct {
	Rows  []Run
	Total int
}

func (r Repository) List(ctx context.Context, page, limit int, status string, year *int) (RunListResult, error) {
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
	whereClause := strings.Join(where, " AND ")
	args = append(args, limit, offset)
	q := fmt.Sprintf(`
SELECT id, payroll_month_date, period_start_date, pay_date, status,
       created_at, updated_at, deleted_at, approved_at, approved_by,
       social_security_rate_employee, social_security_rate_employer,
       COALESCE((SELECT COUNT(1) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_employees,
       COALESCE((SELECT SUM(net_pay) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_net_pay,
       COALESCE((SELECT SUM(income_total) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_income,
       COALESCE((SELECT SUM(income_total - net_pay) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_deduction
FROM payroll_run
WHERE %s
ORDER BY payroll_month_date DESC
LIMIT $%d OFFSET $%d`, whereClause, len(args)-1, len(args))
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
	const q = `
SELECT id, payroll_month_date, period_start_date, pay_date, status,
       created_at, updated_at, deleted_at, approved_at, approved_by,
       social_security_rate_employee, social_security_rate_employer,
       COALESCE((SELECT COUNT(1) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_employees,
       COALESCE((SELECT SUM(net_pay) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_net_pay,
       COALESCE((SELECT SUM(income_total) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_income,
       COALESCE((SELECT SUM(income_total - net_pay) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_deduction
FROM payroll_run
WHERE id=$1 AND deleted_at IS NULL
LIMIT 1`
	var run Run
	if err := db.GetContext(ctx, &run, q, id); err != nil {
		return nil, err
	}
	return &run, nil
}

func (r Repository) Create(ctx context.Context, run Run, actor uuid.UUID) (*Run, error) {
	db := r.dbCtx(ctx)
	const q = `
INSERT INTO payroll_run (
  payroll_month_date, period_start_date, pay_date,
  social_security_rate_employee, social_security_rate_employer,
  status, created_by, updated_by
) VALUES ($1,$2,$3,$4,$5,'processing',$6,$6)
RETURNING id, payroll_month_date, period_start_date, pay_date, status,
          created_at, updated_at, deleted_at, approved_at, approved_by,
          social_security_rate_employee, social_security_rate_employer,
          0 as total_employees, 0 as total_net_pay, 0 as total_income, 0 as total_deduction`
	var out Run
	if err := db.GetContext(ctx, &out, q,
		run.PayrollMonth, run.PeriodStart, run.PayDate,
		run.SSORateEmp, run.SSORateEmployer,
		actor,
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
          COALESCE((SELECT SUM(net_pay) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_net_pay,
          COALESCE((SELECT SUM(income_total) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_income,
          COALESCE((SELECT SUM(income_total - net_pay) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_deduction`
	q := fmt.Sprintf(base, setPayDate)

	var run Run
	if err := db.GetContext(ctx, &run, q, args...); err != nil {
		return nil, err
	}
	return &run, nil
}

func (r Repository) Approve(ctx context.Context, id uuid.UUID, actor uuid.UUID) (*Run, error) {
	db := r.dbCtx(ctx)
	const q = `
UPDATE payroll_run
SET status='approved', approved_by=$1, approved_at=COALESCE(approved_at, now()), updated_by=$1
WHERE id=$2 AND deleted_at IS NULL AND status <> 'approved'
RETURNING id, payroll_month_date, period_start_date, pay_date, status,
          created_at, updated_at, deleted_at, approved_at, approved_by,
          social_security_rate_employee, social_security_rate_employer,
          COALESCE((SELECT COUNT(1) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_employees,
          COALESCE((SELECT SUM(net_pay) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_net_pay,
          COALESCE((SELECT SUM(income_total) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_income,
          COALESCE((SELECT SUM(income_total - net_pay) FROM payroll_run_item pri WHERE pri.run_id = payroll_run.id),0) AS total_deduction`
	var run Run
	if err := db.GetContext(ctx, &run, q, actor, id); err != nil {
		return nil, err
	}
	return &run, nil
}

func (r Repository) SoftDelete(ctx context.Context, id uuid.UUID, actor uuid.UUID) error {
	db := r.dbCtx(ctx)
	const q = `UPDATE payroll_run SET deleted_at=now(), deleted_by=$1 WHERE id=$2 AND deleted_at IS NULL AND status IN ('processing','pending')`
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
	ID                   uuid.UUID `db:"id"`
	RunID                uuid.UUID `db:"run_id"`
	EmployeeID           uuid.UUID `db:"employee_id"`
	EmployeeName         string    `db:"employee_name"`
	SalaryAmount         float64   `db:"salary_amount"`
	OtHours              float64   `db:"ot_hours"`
	OtAmount             float64   `db:"ot_amount"`
	BonusAmount          float64   `db:"bonus_amount"`
	IncomeTotal          float64   `db:"income_total"`
	LeaveDaysQty         float64   `db:"leave_days_qty"`
	LeaveDaysDeduction   float64   `db:"leave_days_deduction"`
	LateMinutesQty       int       `db:"late_minutes_qty"`
	LateMinutesDeduction float64   `db:"late_minutes_deduction"`
	SsoMonthAmount       float64   `db:"sso_month_amount"`
	TaxMonthAmount       float64   `db:"tax_month_amount"`
	NetPay               float64   `db:"net_pay"`
	Status               string    `db:"status"`
	DeductionTotal       float64   `db:"deduction_total"`
}

type ItemListResult struct {
	Rows  []Item
	Total int
}

func (r Repository) ListItems(ctx context.Context, runID uuid.UUID, page, limit int, search string) (ItemListResult, error) {
	db := r.dbCtx(ctx)
	offset := (page - 1) * limit
	var where []string
	var args []interface{}
	where = append(where, "run_id = $1")
	args = append(args, runID)
	if s := strings.TrimSpace(search); s != "" {
		args = append(args, "%"+s+"%")
		where = append(where, fmt.Sprintf("e.full_name ILIKE $%d", len(args)))
	}
	whereClause := strings.Join(where, " AND ")
	args = append(args, limit, offset)
	q := fmt.Sprintf(`
SELECT pri.id, pri.run_id, pri.employee_id, e.full_name AS employee_name,
       pri.salary_amount, pri.ot_hours, pri.ot_amount, pri.bonus_amount,
       pri.income_total, pri.leave_days_qty, pri.leave_days_deduction, pri.late_minutes_qty, pri.late_minutes_deduction,
       pri.sso_month_amount, pri.tax_month_amount, pri.net_pay, 'pending' as status,
       (pri.income_total - pri.net_pay) AS deduction_total
FROM payroll_run_item pri
JOIN employees e ON e.id = pri.employee_id
WHERE %s
ORDER BY e.full_name ASC
LIMIT $%d OFFSET $%d`, whereClause, len(args)-1, len(args))
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
	countQ := fmt.Sprintf("SELECT COUNT(1) FROM payroll_run_item pri JOIN employees e ON e.id = pri.employee_id WHERE %s", whereClause)
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
       (SELECT full_name FROM employees e WHERE e.id = payroll_run_item.employee_id) AS employee_name,
       salary_amount, ot_hours, ot_amount, bonus_amount,
       income_total, leave_days_qty, leave_days_deduction, late_minutes_qty, late_minutes_deduction,
       sso_month_amount, tax_month_amount, net_pay, 'pending' as status,
       (income_total - net_pay) AS deduction_total`, setClause, i)
	var it Item
	if err := db.GetContext(ctx, &it, q, args...); err != nil {
		return nil, err
	}
	return &it, nil
}

func (r Repository) GetItem(ctx context.Context, id uuid.UUID) (*Item, error) {
	db := r.dbCtx(ctx)
	const q = `SELECT pri.id, pri.run_id, pri.employee_id, e.full_name AS employee_name,
       pri.salary_amount, pri.ot_hours, pri.ot_amount, pri.bonus_amount,
       pri.income_total, pri.leave_days_qty, pri.leave_days_deduction, pri.late_minutes_qty, pri.late_minutes_deduction,
       pri.sso_month_amount, pri.tax_month_amount, pri.net_pay, 'pending' as status,
       (pri.income_total - pri.net_pay) AS deduction_total
FROM payroll_run_item pri
JOIN employees e ON e.id = pri.employee_id
WHERE pri.id=$1 LIMIT 1`
	var it Item
	if err := db.GetContext(ctx, &it, q, id); err != nil {
		return nil, err
	}
	return &it, nil
}

type ItemDetail struct {
	Item
	EmployeeTypeID         uuid.UUID `db:"employee_type_id"`
	HousingAllowance       float64   `db:"housing_allowance"`
	AttendanceBonusNoLate  float64   `db:"attendance_bonus_nolate"`
	AttendanceBonusNoLeave float64   `db:"attendance_bonus_noleave"`
	LeaveDoubleQty         float64   `db:"leave_double_qty"`
	LeaveDoubleDeduction   float64   `db:"leave_double_deduction"`
	LeaveHoursQty          float64   `db:"leave_hours_qty"`
	LeaveHoursDeduction    float64   `db:"leave_hours_deduction"`
	SsoDeclaredWage        float64   `db:"sso_declared_wage"`
	SsoAccumPrev           float64   `db:"sso_accum_prev"`
	SsoAccumTotal          float64   `db:"sso_accum_total"`
	TaxAccumPrev           float64   `db:"tax_accum_prev"`
	TaxAccumTotal          float64   `db:"tax_accum_total"`
	PFAccumPrev            float64   `db:"pf_accum_prev"`
	PFMonthAmount          float64   `db:"pf_month_amount"`
	PFAccumTotal           float64   `db:"pf_accum_total"`
	AdvanceAmount          float64   `db:"advance_amount"`
	AdvanceRepayAmount     float64   `db:"advance_repay_amount"`
	AdvanceDiffAmount      float64   `db:"advance_diff_amount"`
	LoanOutstandingPrev    float64   `db:"loan_outstanding_prev"`
	LoanOutstandingTotal   float64   `db:"loan_outstanding_total"`
	LoanRepayments         []byte    `db:"loan_repayments"`
	OthersIncome           []byte    `db:"others_income"`
	WaterAmount            float64   `db:"water_amount"`
	ElectricAmount         float64   `db:"electric_amount"`
	InternetAmount         float64   `db:"internet_amount"`
	BankAccount            *string   `db:"bank_account"`
}

func (r Repository) GetItemDetail(ctx context.Context, id uuid.UUID) (*ItemDetail, error) {
	db := r.dbCtx(ctx)
	const q = `SELECT pri.id, pri.run_id, pri.employee_id, e.full_name AS employee_name,
       pri.salary_amount, pri.ot_hours, pri.ot_amount, pri.bonus_amount,
       pri.income_total, pri.leave_days_qty, pri.leave_days_deduction, pri.late_minutes_qty, pri.late_minutes_deduction,
       pri.sso_month_amount, pri.tax_month_amount, pri.net_pay, 'pending' AS status,
       (pri.income_total - pri.net_pay) AS deduction_total,
       pri.employee_type_id,
       pri.housing_allowance, pri.attendance_bonus_nolate, pri.attendance_bonus_noleave,
       pri.leave_double_qty, pri.leave_double_deduction, pri.leave_hours_qty, pri.leave_hours_deduction,
       pri.sso_declared_wage, pri.sso_accum_prev, pri.sso_accum_total,
       pri.tax_accum_prev, pri.tax_accum_total,
       pri.pf_accum_prev, pri.pf_month_amount, pri.pf_accum_total,
       pri.advance_amount, pri.advance_repay_amount, pri.advance_diff_amount,
       pri.loan_outstanding_prev, pri.loan_outstanding_total, pri.loan_repayments,
       pri.others_income, pri.water_amount, pri.electric_amount, pri.internet_amount,
       u.bank_account
FROM payroll_run_item pri
JOIN employees e ON e.id = pri.employee_id
LEFT JOIN users u ON u.id = e.user_id
WHERE pri.id = $1`
	var it ItemDetail
	if err := db.GetContext(ctx, &it, q, id); err != nil {
		return nil, err
	}
	return &it, nil
}

func IsNotFound(err error) bool {
	return errors.Is(err, sql.ErrNoRows)
}
