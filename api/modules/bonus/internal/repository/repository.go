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
	ID             uuid.UUID `db:"id"`
	CycleID        uuid.UUID `db:"cycle_id"`
	EmployeeID     uuid.UUID `db:"employee_id"`
	EmployeeName   string    `db:"employee_name"`
	EmployeeNumber string    `db:"employee_number"`
	TenureDays     int       `db:"tenure_days"`
	CurrentSalary  float64   `db:"current_salary"`
	LateMinutes    int       `db:"late_minutes"`
	LeaveDays      float64   `db:"leave_days"`
	LeaveDouble    float64   `db:"leave_double_days"`
	LeaveHours     float64   `db:"leave_hours"`
	OtHours        float64   `db:"ot_hours"`
	BonusMonths    float64   `db:"bonus_months"`
	BonusAmount    float64   `db:"bonus_amount"`
	UpdatedAt      time.Time `db:"updated_at"`
}

type ListResult struct {
	Rows  []Cycle
	Total int
}

func (r Repository) List(ctx context.Context, page, limit int, status string, year *int) (ListResult, error) {
	db := r.dbCtx(ctx)
	offset := (page - 1) * limit
	if offset < 0 {
		offset = 0
	}

	where := "deleted_at IS NULL"
	var args []interface{}
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

func (r Repository) Get(ctx context.Context, id uuid.UUID) (*Cycle, []Item, error) {
	db := r.dbCtx(ctx)
	const q = `SELECT id, payroll_month_date, bonus_year, period_start_date, period_end_date, status, created_at, updated_at, deleted_at FROM bonus_cycle WHERE id=$1 AND deleted_at IS NULL LIMIT 1`
	var c Cycle
	if err := db.GetContext(ctx, &c, q, id); err != nil {
		return nil, nil, err
	}
	items, err := r.ListItems(ctx, id, "")
	if err != nil {
		return nil, nil, err
	}
	return &c, items, nil
}

func (r Repository) Create(ctx context.Context, payrollMonth time.Time, bonusYear int, start, end time.Time, actor uuid.UUID) (*Cycle, error) {
	db := r.dbCtx(ctx)
	const q = `
INSERT INTO bonus_cycle (payroll_month_date, bonus_year, period_start_date, period_end_date, status, created_by, updated_by)
VALUES ($1, $2, $3, $4,'pending',$5,$5)
RETURNING id, payroll_month_date, bonus_year, period_start_date, period_end_date, status, created_at, updated_at, deleted_at`
	var c Cycle
	if err := db.GetContext(ctx, &c, q, payrollMonth, bonusYear, start, end, actor); err != nil {
		return nil, err
	}
	return &c, nil
}

func (r Repository) UpdateStatus(ctx context.Context, id uuid.UUID, status string, actor uuid.UUID) (*Cycle, error) {
	db := r.dbCtx(ctx)
	const q = `
UPDATE bonus_cycle
SET status=$1, updated_by=$2
WHERE id=$3 AND deleted_at IS NULL
RETURNING id, payroll_month_date, bonus_year, period_start_date, period_end_date, status, created_at, updated_at, deleted_at`
	var c Cycle
	if err := db.GetContext(ctx, &c, q, status, actor, id); err != nil {
		return nil, err
	}
	return &c, nil
}

func (r Repository) DeleteCycle(ctx context.Context, id uuid.UUID, actor uuid.UUID) error {
	db := r.dbCtx(ctx)
	res, err := db.ExecContext(ctx, `UPDATE bonus_cycle SET deleted_at=now(), deleted_by=$1 WHERE id=$2 AND deleted_at IS NULL`, actor, id)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r Repository) ListItems(ctx context.Context, cycleID uuid.UUID, search string) ([]Item, error) {
	db := r.dbCtx(ctx)
	where := "bi.cycle_id = $1"
	args := []interface{}{cycleID}
	if s := strings.TrimSpace(search); s != "" {
		args = append(args, "%"+s+"%")
		where += fmt.Sprintf(" AND (LOWER(e.first_name) LIKE $%d OR LOWER(e.last_name) LIKE $%d)", len(args), len(args))
	}
	q := fmt.Sprintf(`SELECT bi.id, bi.cycle_id, bi.employee_id,
       (e.first_name || ' ' || e.last_name) AS employee_name,
       e.employee_number AS employee_number,
       bi.tenure_days, bi.current_salary, bi.late_minutes, bi.leave_days, bi.leave_double_days, bi.leave_hours, bi.ot_hours,
       bi.bonus_months, bi.bonus_amount, bi.updated_at
FROM bonus_item bi
JOIN employees e ON e.id = bi.employee_id
WHERE %s
ORDER BY employee_name`, where)
	var out []Item
	if err := db.SelectContext(ctx, &out, q, args...); err != nil {
		return nil, err
	}
	return out, nil
}

func (r Repository) GetItem(ctx context.Context, id uuid.UUID) (*Item, *Cycle, error) {
	db := r.dbCtx(ctx)
	const q = `SELECT bi.id, bi.cycle_id, bi.employee_id,
       (e.first_name || ' ' || e.last_name) AS employee_name,
       e.employee_number AS employee_number,
       bi.tenure_days, bi.current_salary, bi.late_minutes, bi.leave_days, bi.leave_double_days, bi.leave_hours, bi.ot_hours,
       bi.bonus_months, bi.bonus_amount, bi.updated_at
FROM bonus_item bi
JOIN employees e ON e.id = bi.employee_id
WHERE bi.id=$1 LIMIT 1`
	var it Item
	if err := db.GetContext(ctx, &it, q, id); err != nil {
		return nil, nil, err
	}
	cycle, _, err := r.Get(ctx, it.CycleID)
	if err != nil {
		return nil, nil, err
	}
	return &it, cycle, nil
}

func (r Repository) UpdateItem(ctx context.Context, id uuid.UUID, months *float64, amount *float64, actor uuid.UUID) (*Item, error) {
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
	args = append(args, id)
	setClause := strings.Join(sets, ",")
	q := fmt.Sprintf(`UPDATE bonus_item SET %s WHERE id=$%d RETURNING id, cycle_id, employee_id,
       (SELECT (first_name || ' ' || last_name) FROM employees e WHERE e.id = bonus_item.employee_id) AS employee_name,
       tenure_days, current_salary, late_minutes, leave_days, leave_double_days, leave_hours, ot_hours,
       bonus_months, bonus_amount, updated_at`, setClause, argIdx)
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
