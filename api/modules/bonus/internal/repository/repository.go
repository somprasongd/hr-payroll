package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"

	"hrms/shared/common/contextx"
	"hrms/shared/common/storage/sqldb/transactor"
)

type Repository struct {
	dbCtx transactor.DBTXContext
}

func NewRepository(dbCtx transactor.DBTXContext) Repository {
	return Repository{dbCtx: dbCtx}
}

type Cycle struct {
	ID             uuid.UUID  `db:"id"`
	PayrollMonth   time.Time  `db:"payroll_month_date"`
	BonusYear      int        `db:"bonus_year"`
	PeriodStart    time.Time  `db:"period_start_date"`
	PeriodEnd      time.Time  `db:"period_end_date"`
	Status         string     `db:"status"`
	CreatedAt      time.Time  `db:"created_at"`
	UpdatedAt      time.Time  `db:"updated_at"`
	DeletedAt      *time.Time `db:"deleted_at"`
	TotalEmployees int        `db:"total_employees"`
	TotalBonus     float64    `db:"total_bonus_amount"`
}

type Item struct {
	ID             uuid.UUID  `db:"id"`
	CycleID        uuid.UUID  `db:"cycle_id"`
	EmployeeID     uuid.UUID  `db:"employee_id"`
	EmployeeName   string     `db:"employee_name"`
	EmployeeNumber string     `db:"employee_number"`
	PhotoID        *uuid.UUID `db:"photo_id"`
	TenureDays     int        `db:"tenure_days"`
	CurrentSalary  float64    `db:"current_salary"`
	LateMinutes    int        `db:"late_minutes"`
	LeaveDays      float64    `db:"leave_days"`
	LeaveDouble    float64    `db:"leave_double_days"`
	LeaveHours     float64    `db:"leave_hours"`
	OtHours        float64    `db:"ot_hours"`
	BonusMonths    float64    `db:"bonus_months"`
	BonusAmount    float64    `db:"bonus_amount"`
	UpdatedAt      time.Time  `db:"updated_at"`
}

type ListResult struct {
	Rows  []Cycle
	Total int
}

func (r Repository) List(ctx context.Context, tenant contextx.TenantInfo, page, limit int, status string, year *int) (ListResult, error) {
	db := r.dbCtx(ctx)
	offset := (page - 1) * limit
	if offset < 0 {
		offset = 0
	}

	where := "deleted_at IS NULL"
	var args []interface{}

	// Company Filter
	args = append(args, tenant.CompanyID)
	where += fmt.Sprintf(" AND company_id = $%d", len(args))

	// Branch Filter
	if tenant.HasBranchID() {
		args = append(args, tenant.BranchID)
		where += fmt.Sprintf(" AND branch_id = $%d", len(args))
	}

	if status != "" && status != "all" {
		args = append(args, status)
		where += fmt.Sprintf(" AND status = $%d", len(args))
	}
	if year != nil {
		args = append(args, *year)
		where += fmt.Sprintf(" AND bonus_year = $%d", len(args))
	}

	// list query uses filter args + limit/offset at the end
	argsWithPage := append(append([]interface{}{}, args...), limit, offset)
	q := fmt.Sprintf(`
SELECT id, payroll_month_date, bonus_year, period_start_date, period_end_date, status, created_at, updated_at, deleted_at,
  COALESCE((SELECT COUNT(1) FROM bonus_item bi WHERE bi.cycle_id = bc.id),0) AS total_employees,
  COALESCE((SELECT SUM(bonus_amount) FROM bonus_item bi WHERE bi.cycle_id = bc.id),0) AS total_bonus_amount
FROM bonus_cycle bc
WHERE %s
ORDER BY created_at DESC
LIMIT $%d OFFSET $%d`, where, len(args)+1, len(args)+2)
	rows, err := db.QueryxContext(ctx, q, argsWithPage...)
	if err != nil {
		return ListResult{}, err
	}
	defer rows.Close()

	var cycles []Cycle
	for rows.Next() {
		var c Cycle
		if err := rows.StructScan(&c); err != nil {
			return ListResult{}, err
		}
		cycles = append(cycles, c)
	}
	var total int
	countQ := "SELECT COUNT(1) FROM bonus_cycle WHERE " + where
	if err := db.GetContext(ctx, &total, countQ, args...); err != nil {
		return ListResult{}, err
	}
	return ListResult{Rows: cycles, Total: total}, nil
}

func (r Repository) Get(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID) (*Cycle, []Item, error) {
	db := r.dbCtx(ctx)
	// Check company access for the cycle
	q := `SELECT id, payroll_month_date, bonus_year, period_start_date, period_end_date, status, created_at, updated_at, deleted_at 
	      FROM bonus_cycle WHERE id=$1 AND company_id=$2 AND deleted_at IS NULL LIMIT 1`
	args := []interface{}{id, tenant.CompanyID}
	if tenant.HasBranchID() {
		q = `SELECT id, payroll_month_date, bonus_year, period_start_date, period_end_date, status, created_at, updated_at, deleted_at 
	      FROM bonus_cycle WHERE id=$1 AND company_id=$2 AND branch_id=$3 AND deleted_at IS NULL LIMIT 1`
		args = append(args, tenant.BranchID)
	}
	var c Cycle
	if err := db.GetContext(ctx, &c, q, args...); err != nil {
		return nil, nil, err
	}
	items, err := r.ListItems(ctx, tenant, id, "")
	if err != nil {
		return nil, nil, err
	}
	return &c, items, nil
}

func (r Repository) Create(ctx context.Context, payrollMonth time.Time, bonusYear int, start, end time.Time, companyID, branchID, actor uuid.UUID) (*Cycle, error) {
	db := r.dbCtx(ctx)
	const q = `
INSERT INTO bonus_cycle (payroll_month_date, bonus_year, period_start_date, period_end_date, status, company_id, branch_id, created_by, updated_by)
VALUES ($1, $2, $3, $4,'pending',$5,$6,$7,$7)
RETURNING id, payroll_month_date, bonus_year, period_start_date, period_end_date, status, created_at, updated_at, deleted_at`
	var c Cycle
	if err := db.GetContext(ctx, &c, q, payrollMonth, bonusYear, start, end, companyID, branchID, actor); err != nil {
		return nil, err
	}
	return &c, nil
}

func (r Repository) UpdateStatus(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID, status string, actor uuid.UUID) (*Cycle, error) {
	db := r.dbCtx(ctx)
	q := `
UPDATE bonus_cycle
SET status=$1, updated_by=$2
WHERE id=$3 AND company_id=$4 AND deleted_at IS NULL
RETURNING id, payroll_month_date, bonus_year, period_start_date, period_end_date, status, created_at, updated_at, deleted_at`
	args := []interface{}{status, actor, id, tenant.CompanyID}
	if tenant.HasBranchID() {
		q = `
UPDATE bonus_cycle
SET status=$1, updated_by=$2
WHERE id=$3 AND company_id=$4 AND branch_id=$5 AND deleted_at IS NULL
RETURNING id, payroll_month_date, bonus_year, period_start_date, period_end_date, status, created_at, updated_at, deleted_at`
		args = append(args, tenant.BranchID)
	}
	var c Cycle
	if err := db.GetContext(ctx, &c, q, args...); err != nil {
		return nil, err
	}
	return &c, nil
}

func (r Repository) DeleteCycle(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID, actor uuid.UUID) error {
	db := r.dbCtx(ctx)
	q := `UPDATE bonus_cycle SET deleted_at=now(), deleted_by=$1 WHERE id=$2 AND company_id=$3 AND deleted_at IS NULL`
	args := []interface{}{actor, id, tenant.CompanyID}
	if tenant.HasBranchID() {
		q = `UPDATE bonus_cycle SET deleted_at=now(), deleted_by=$1 WHERE id=$2 AND company_id=$3 AND branch_id=$4 AND deleted_at IS NULL`
		args = append(args, tenant.BranchID)
	}
	res, err := db.ExecContext(ctx, q, args...)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r Repository) ListItems(ctx context.Context, tenant contextx.TenantInfo, cycleID uuid.UUID, search string) ([]Item, error) {
	db := r.dbCtx(ctx)
	where := "bi.cycle_id = $1"
	args := []interface{}{cycleID}

	// Company Filter (via employees)
	args = append(args, tenant.CompanyID)
	where += fmt.Sprintf(" AND e.company_id = $%d", len(args))

	// Branch Filter
	if tenant.HasBranchID() {
		args = append(args, tenant.BranchID)
		where += fmt.Sprintf(" AND e.branch_id = $%d", len(args))
	}

	fullNameExpr := "(pt.name_th || e.first_name || ' ' || e.last_name || COALESCE(' (' || NULLIF(e.nickname, '') || ')', ''))"
	if s := strings.TrimSpace(search); s != "" {
		args = append(args, "%"+s+"%")
		where += fmt.Sprintf(" AND (%s ILIKE $%d)", fullNameExpr, len(args))
	}
	q := fmt.Sprintf(`SELECT bi.id, bi.cycle_id, bi.employee_id,
       %s AS employee_name,
       e.employee_number AS employee_number,
       e.photo_id AS photo_id,
       bi.tenure_days, bi.current_salary, bi.late_minutes, bi.leave_days, bi.leave_double_days, bi.leave_hours, bi.ot_hours,
       bi.bonus_months, bi.bonus_amount, bi.updated_at
FROM bonus_item bi
JOIN employees e ON e.id = bi.employee_id
LEFT JOIN person_title pt ON pt.id = e.title_id
WHERE %s
ORDER BY e.employee_number ASC, employee_name`, fullNameExpr, where)
	var out []Item
	if err := db.SelectContext(ctx, &out, q, args...); err != nil {
		return nil, err
	}
	return out, nil
}

func (r Repository) GetItem(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID) (*Item, *Cycle, error) {
	db := r.dbCtx(ctx)
	// Join employees to check company access
	q := `SELECT bi.id, bi.cycle_id, bi.employee_id,
       (pt.name_th || e.first_name || ' ' || e.last_name || COALESCE(' (' || NULLIF(e.nickname, '') || ')', '')) AS employee_name,
       e.employee_number AS employee_number,
       e.photo_id AS photo_id,
       bi.tenure_days, bi.current_salary, bi.late_minutes, bi.leave_days, bi.leave_double_days, bi.leave_hours, bi.ot_hours,
       bi.bonus_months, bi.bonus_amount, bi.updated_at
FROM bonus_item bi
JOIN employees e ON e.id = bi.employee_id
LEFT JOIN person_title pt ON pt.id = e.title_id
WHERE bi.id=$1 AND e.company_id=$2 LIMIT 1`
	args := []interface{}{id, tenant.CompanyID}
	if tenant.HasBranchID() {
		q = `SELECT bi.id, bi.cycle_id, bi.employee_id,
       concat_ws(' ', pt.name_th, e.first_name, e.last_name) AS employee_name,
       e.employee_number AS employee_number,
       e.photo_id AS photo_id,
       bi.tenure_days, bi.current_salary, bi.late_minutes, bi.leave_days, bi.leave_double_days, bi.leave_hours, bi.ot_hours,
       bi.bonus_months, bi.bonus_amount, bi.updated_at
FROM bonus_item bi
JOIN employees e ON e.id = bi.employee_id
LEFT JOIN person_title pt ON pt.id = e.title_id
WHERE bi.id=$1 AND e.company_id=$2 AND e.branch_id=$3 LIMIT 1`
		args = append(args, tenant.BranchID)
	}
	var it Item
	if err := db.GetContext(ctx, &it, q, args...); err != nil {
		return nil, nil, err
	}
	cycle, _, err := r.Get(ctx, tenant, it.CycleID)
	if err != nil {
		return nil, nil, err
	}
	return &it, cycle, nil
}

func (r Repository) UpdateItem(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID, months *float64, amount *float64, actor uuid.UUID) (*Item, error) {
	db := r.dbCtx(ctx)
	sets := []string{"updated_by=$1"}
	args := []interface{}{actor}
	argIdx := 2
	if months != nil {
		sets = append(sets, fmt.Sprintf("bonus_months=$%d", argIdx))
		args = append(args, *months)
		argIdx++
	}
	if amount != nil {
		sets = append(sets, fmt.Sprintf("bonus_amount=$%d", argIdx))
		args = append(args, *amount)
		argIdx++
	}
	if len(sets) == 1 {
		return nil, fmt.Errorf("no fields to update")
	}
	args = append(args, id, tenant.CompanyID)
	setClause := strings.Join(sets, ",")
	branchClause := ""
	if tenant.HasBranchID() {
		branchClause = fmt.Sprintf(" AND e.branch_id=$%d", argIdx+2)
		args = append(args, tenant.BranchID)
	}
	q := fmt.Sprintf(`
UPDATE bonus_item 
SET %s 
FROM employees e
WHERE bonus_item.id=$%d AND bonus_item.employee_id = e.id AND e.company_id=$%d%s
RETURNING bonus_item.id, bonus_item.cycle_id, bonus_item.employee_id,
       (SELECT (pt.name_th || e.first_name || ' ' || e.last_name || COALESCE(' (' || NULLIF(e.nickname, '') || ')', '')) FROM employees e LEFT JOIN person_title pt ON pt.id = e.title_id WHERE e.id = bonus_item.employee_id) AS employee_name,
       bonus_item.tenure_days, bonus_item.current_salary, bonus_item.late_minutes, bonus_item.leave_days, bonus_item.leave_double_days, bonus_item.leave_hours, bonus_item.ot_hours,
       bonus_item.bonus_months, bonus_item.bonus_amount, bonus_item.updated_at`, setClause, argIdx, argIdx+1, branchClause)
	var out Item
	if err := db.GetContext(ctx, &out, q, args...); err != nil {
		return nil, err
	}
	return &out, nil
}

// IsUniqueViolation reports whether the error is a Postgres unique_violation (optional constraint name match).
func IsUniqueViolation(err error, constraint string) bool {
	var pqErr *pq.Error
	if errors.As(err, &pqErr) && pqErr.Code == "23505" {
		if constraint == "" {
			return true
		}
		return pqErr.Constraint == constraint
	}
	return false
}

// GetPendingCycle returns the pending bonus cycle for the tenant (if any)
func (r Repository) GetPendingCycle(ctx context.Context, tenant contextx.TenantInfo) (*Cycle, error) {
	db := r.dbCtx(ctx)
	q := `SELECT id, payroll_month_date, bonus_year, period_start_date, period_end_date, status, created_at, updated_at, deleted_at
	      FROM bonus_cycle 
	      WHERE status='pending' AND company_id=$1 AND deleted_at IS NULL LIMIT 1`
	args := []interface{}{tenant.CompanyID}
	if tenant.HasBranchID() {
		q = `SELECT id, payroll_month_date, bonus_year, period_start_date, period_end_date, status, created_at, updated_at, deleted_at
	      FROM bonus_cycle 
	      WHERE status='pending' AND company_id=$1 AND branch_id=$2 AND deleted_at IS NULL LIMIT 1`
		args = append(args, tenant.BranchID)
	}
	var c Cycle
	if err := db.GetContext(ctx, &c, q, args...); err != nil {
		return nil, err
	}
	return &c, nil
}

// AddEmployeeToPendingCycle adds an employee to the pending bonus cycle
func (r Repository) AddEmployeeToPendingCycle(ctx context.Context, tenant contextx.TenantInfo, employeeID uuid.UUID, actor uuid.UUID) error {
	db := r.dbCtx(ctx)

	// Get pending cycle
	cycle, err := r.GetPendingCycle(ctx, tenant)
	if err != nil {
		return err // includes sql.ErrNoRows if no pending cycle
	}

	// Insert bonus_item with snapshot data from employee
	q := `
INSERT INTO bonus_item (
    cycle_id, employee_id, tenure_days,
    current_salary,
    late_minutes, leave_days, leave_double_days, leave_hours, ot_hours,
    bonus_months, bonus_amount,
    created_by, updated_by, company_id, branch_id
)
SELECT 
    $1, e.id,
    (DATE($2) - e.employment_start_date) AS tenure_days,
    e.base_pay_amount,
    -- Snapshot from worklog_ft
    COALESCE((
        SELECT SUM(w.quantity)::INT
        FROM worklog_ft w
        WHERE w.employee_id = e.id
          AND w.entry_type = 'late'
          AND w.work_date BETWEEN $3 AND $4
          AND w.deleted_at IS NULL
          AND w.status IN ('pending','approved')
    ), 0) AS late_minutes,
    COALESCE((
        SELECT SUM(w.quantity)::NUMERIC(6,2)
        FROM worklog_ft w
        WHERE w.employee_id = e.id
          AND w.entry_type = 'leave_day'
          AND w.work_date BETWEEN $3 AND $4
          AND w.deleted_at IS NULL
          AND w.status IN ('pending','approved')
    ), 0.00) AS leave_days,
    COALESCE((
        SELECT SUM(w.quantity)::NUMERIC(6,2)
        FROM worklog_ft w
        WHERE w.employee_id = e.id
          AND w.entry_type = 'leave_double'
          AND w.work_date BETWEEN $3 AND $4
          AND w.deleted_at IS NULL
          AND w.status IN ('pending','approved')
    ), 0.00) AS leave_double_days,
    COALESCE((
        SELECT SUM(w.quantity)::NUMERIC(6,2)
        FROM worklog_ft w
        WHERE w.employee_id = e.id
          AND w.entry_type = 'leave_hours'
          AND w.work_date BETWEEN $3 AND $4
          AND w.deleted_at IS NULL
          AND w.status IN ('pending','approved')
    ), 0.00) AS leave_hours,
    COALESCE((
        SELECT SUM(w.quantity)::NUMERIC(6,2)
        FROM worklog_ft w
        WHERE w.employee_id = e.id
          AND w.entry_type = 'ot'
          AND w.work_date BETWEEN $3 AND $4
          AND w.deleted_at IS NULL
          AND w.status IN ('pending','approved')
    ), 0.00) AS ot_hours,
    0.00, 0.00,
    $5, $5, e.company_id, e.branch_id
FROM employees e
WHERE e.id = $6 AND e.deleted_at IS NULL
ON CONFLICT (cycle_id, employee_id) DO NOTHING`

	_, err = db.ExecContext(ctx, q, cycle.ID, cycle.CreatedAt, cycle.PeriodStart, cycle.PeriodEnd, actor, employeeID)
	return err
}

// RemoveEmployeeFromPendingCycle removes an employee from the pending bonus cycle
func (r Repository) RemoveEmployeeFromPendingCycle(ctx context.Context, tenant contextx.TenantInfo, employeeID uuid.UUID) error {
	db := r.dbCtx(ctx)

	// Get pending cycle
	cycle, err := r.GetPendingCycle(ctx, tenant)
	if err != nil {
		return err // includes sql.ErrNoRows if no pending cycle
	}

	q := `DELETE FROM bonus_item WHERE cycle_id = $1 AND employee_id = $2`
	_, err = db.ExecContext(ctx, q, cycle.ID, employeeID)
	return err
}
