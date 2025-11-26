package repository

import (
	"context"
	"database/sql"
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

type Cycle struct {
	ID             uuid.UUID  `db:"id"`
	PeriodStart    time.Time  `db:"period_start_date"`
	PeriodEnd      time.Time  `db:"period_end_date"`
	Status         string     `db:"status"`
	CreatedAt      time.Time  `db:"created_at"`
	UpdatedAt      time.Time  `db:"updated_at"`
	DeletedAt      *time.Time `db:"deleted_at"`
	TotalEmployees int        `db:"total_employees"`
	TotalRaise     float64    `db:"total_raise_amount"`
}

type Stats struct {
	LateMinutes     int     `json:"lateMinutes"`
	LeaveDays       float64 `json:"leaveDays"`
	LeaveDoubleDays float64 `json:"leaveDoubleDays"`
	LeaveHours      float64 `json:"leaveHours"`
	OtHours         float64 `json:"otHours"`
}

type Item struct {
	ID             uuid.UUID `db:"id" json:"id"`
	CycleID        uuid.UUID `db:"cycle_id" json:"cycleId"`
	EmployeeID     uuid.UUID `db:"employee_id" json:"employeeId"`
	EmployeeName   string    `db:"employee_name" json:"employeeName"`
	TenureDays     int       `db:"tenure_days" json:"tenureDays"`
	CurrentSalary  float64   `db:"current_salary" json:"currentSalary"`
	CurrentSSOWage *float64  `db:"current_sso_wage" json:"currentSsoWage,omitempty"`
	RaisePercent   float64   `db:"raise_percent" json:"raisePercent"`
	RaiseAmount    float64   `db:"raise_amount" json:"raiseAmount"`
	NewSalary      float64   `db:"new_salary" json:"newSalary"`
	NewSSOWage     float64   `db:"new_sso_wage" json:"newSsoWage,omitempty"`
	UpdatedAt      time.Time `db:"updated_at" json:"updatedAt"`
	LateMinutes    int       `db:"late_minutes" json:"-"`
	LeaveDays      float64   `db:"leave_days" json:"-"`
	LeaveDouble    float64   `db:"leave_double_days" json:"-"`
	LeaveHours     float64   `db:"leave_hours" json:"-"`
	OtHours        float64   `db:"ot_hours" json:"-"`
	Stats          Stats     `db:"-" json:"stats"`
}

func (i *Item) hydrateStats() {
	i.Stats = Stats{
		LateMinutes:     i.LateMinutes,
		LeaveDays:       i.LeaveDays,
		LeaveDoubleDays: i.LeaveDouble,
		LeaveHours:      i.LeaveHours,
		OtHours:         i.OtHours,
	}
}

type ListResult struct {
	Rows  []Cycle
	Total int
}

func (r Repository) List(ctx context.Context, page, limit int, status string, year *int) (ListResult, error) {
	db := r.dbCtx(ctx)
	offset := (page - 1) * limit
	conds := []string{"deleted_at IS NULL"}
	args := []interface{}{}
	if status != "" && status != "all" {
		conds = append(conds, fmt.Sprintf("status = $%d", len(args)+1))
		args = append(args, status)
	}
	if year != nil {
		conds = append(conds, fmt.Sprintf("EXTRACT(YEAR FROM period_start_date) = $%d", len(args)+1))
		args = append(args, *year)
	}
	where := strings.Join(conds, " AND ")
	limitPlaceholder := len(args) + 1
	offsetPlaceholder := len(args) + 2
	q := fmt.Sprintf(`
SELECT id, period_start_date, period_end_date, status, created_at, updated_at, deleted_at,
  COALESCE((SELECT COUNT(1) FROM salary_raise_item sri WHERE sri.cycle_id = src.id),0) AS total_employees,
  COALESCE((SELECT SUM(raise_amount) FROM salary_raise_item sri WHERE sri.cycle_id = src.id),0) AS total_raise_amount
FROM salary_raise_cycle src
WHERE %s
ORDER BY created_at DESC
LIMIT $%d OFFSET $%d`, where, limitPlaceholder, offsetPlaceholder)
	listArgs := append(args, limit, offset)
	rows, err := db.QueryxContext(ctx, q, listArgs...)
	if err != nil {
		return ListResult{}, err
	}
	defer rows.Close()

	var items []Cycle
	for rows.Next() {
		var c Cycle
		if err := rows.StructScan(&c); err != nil {
			return ListResult{}, err
		}
		items = append(items, c)
	}
	var total int
	countQ := "SELECT COUNT(1) FROM salary_raise_cycle WHERE " + where
	if err := db.GetContext(ctx, &total, countQ, args...); err != nil {
		return ListResult{}, err
	}
	return ListResult{Rows: items, Total: total}, nil
}

func (r Repository) Get(ctx context.Context, id uuid.UUID) (*Cycle, []Item, error) {
	db := r.dbCtx(ctx)
	const q = `SELECT id, period_start_date, period_end_date, status, created_at, updated_at, deleted_at FROM salary_raise_cycle WHERE id=$1 AND deleted_at IS NULL LIMIT 1`
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

func (r Repository) Create(ctx context.Context, periodStart, periodEnd time.Time, actor uuid.UUID) (*Cycle, error) {
	db := r.dbCtx(ctx)
	const q = `
INSERT INTO salary_raise_cycle (period_start_date, period_end_date, status, created_by, updated_by)
VALUES ($1,$2,'pending',$3,$3)
RETURNING id, period_start_date, period_end_date, status, created_at, updated_at, deleted_at`
	var c Cycle
	if err := db.GetContext(ctx, &c, q, periodStart, periodEnd, actor); err != nil {
		return nil, err
	}
	return &c, nil
}

func (r Repository) UpdateStatus(ctx context.Context, id uuid.UUID, status string, actor uuid.UUID) (*Cycle, error) {
	db := r.dbCtx(ctx)
	const q = `
UPDATE salary_raise_cycle
SET status=$1, updated_by=$2
WHERE id=$3 AND deleted_at IS NULL
RETURNING id, period_start_date, period_end_date, status, created_at, updated_at, deleted_at`
	var c Cycle
	if err := db.GetContext(ctx, &c, q, status, actor, id); err != nil {
		return nil, err
	}
	return &c, nil
}

func (r Repository) UpdateCycle(ctx context.Context, id uuid.UUID, start, end *time.Time, status *string, actor uuid.UUID) (*Cycle, error) {
	db := r.dbCtx(ctx)
	sets := []string{"updated_by=$1"}
	args := []interface{}{actor}
	argIdx := 2
	if start != nil {
		sets = append(sets, fmt.Sprintf("period_start_date=$%d", argIdx))
		args = append(args, *start)
		argIdx++
	}
	if end != nil {
		sets = append(sets, fmt.Sprintf("period_end_date=$%d", argIdx))
		args = append(args, *end)
		argIdx++
	}
	if status != nil {
		sets = append(sets, fmt.Sprintf("status=$%d", argIdx))
		args = append(args, *status)
		argIdx++
	}
	if len(sets) == 1 {
		return nil, fmt.Errorf("no fields to update")
	}
	args = append(args, id)
	q := fmt.Sprintf(`
UPDATE salary_raise_cycle
SET %s
WHERE id=$%d AND deleted_at IS NULL
RETURNING id, period_start_date, period_end_date, status, created_at, updated_at, deleted_at`, strings.Join(sets, ","), argIdx)
	var c Cycle
	if err := db.GetContext(ctx, &c, q, args...); err != nil {
		return nil, err
	}
	return &c, nil
}

func (r Repository) GetItem(ctx context.Context, id uuid.UUID) (*Item, *Cycle, error) {
	db := r.dbCtx(ctx)
	const qi = `SELECT sri.id, sri.cycle_id, sri.employee_id,
       (e.first_name || ' ' || e.last_name) AS employee_name,
       sri.tenure_days, sri.current_salary, sri.current_sso_wage,
       sri.raise_percent, sri.raise_amount, sri.new_salary, sri.new_sso_wage,
       sri.late_minutes, sri.leave_days, sri.leave_double_days, sri.leave_hours, sri.ot_hours,
       sri.updated_at
FROM salary_raise_item sri
JOIN employees e ON e.id = sri.employee_id
WHERE sri.id=$1 LIMIT 1`
	var it Item
	if err := db.GetContext(ctx, &it, qi, id); err != nil {
		return nil, nil, err
	}
	it.hydrateStats()
	cycle, _, err := r.Get(ctx, it.CycleID)
	if err != nil {
		return nil, nil, err
	}
	return &it, cycle, nil
}

func (r Repository) DeleteCycle(ctx context.Context, id uuid.UUID, actor uuid.UUID) error {
	db := r.dbCtx(ctx)
	res, err := db.ExecContext(ctx, `UPDATE salary_raise_cycle SET deleted_at=now(), deleted_by=$1 WHERE id=$2 AND deleted_at IS NULL`, actor, id)
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
	where := "sri.cycle_id = $1"
	args := []interface{}{cycleID}
	if s := strings.TrimSpace(search); s != "" {
		args = append(args, "%"+s+"%")
		where += fmt.Sprintf(" AND (LOWER(e.first_name) LIKE $%d OR LOWER(e.last_name) LIKE $%d)", len(args), len(args))
	}
	q := fmt.Sprintf(`SELECT sri.id, sri.cycle_id, sri.employee_id,
       (e.first_name || ' ' || e.last_name) AS employee_name,
       sri.tenure_days, sri.current_salary, sri.current_sso_wage,
       sri.raise_percent, sri.raise_amount, sri.new_salary, sri.new_sso_wage,
       sri.late_minutes, sri.leave_days, sri.leave_double_days, sri.leave_hours, sri.ot_hours,
       sri.updated_at
FROM salary_raise_item sri
JOIN employees e ON e.id = sri.employee_id
WHERE %s
ORDER BY employee_name`, where)
	var out []Item
	if err := db.SelectContext(ctx, &out, q, args...); err != nil {
		return nil, err
	}
	for idx := range out {
		out[idx].hydrateStats()
	}
	return out, nil
}

func (r Repository) UpdateItem(ctx context.Context, id uuid.UUID, percent, amount, newSSO *float64, actor uuid.UUID) (*Item, error) {
	db := r.dbCtx(ctx)
	sets := []string{"updated_by=$1"}
	args := []interface{}{actor}
	argIdx := 2
	if percent != nil {
		sets = append(sets, fmt.Sprintf("raise_percent=$%d", argIdx))
		args = append(args, *percent)
		argIdx++
	}
	if amount != nil {
		sets = append(sets, fmt.Sprintf("raise_amount=$%d", argIdx))
		args = append(args, *amount)
		argIdx++
	}
	if newSSO != nil {
		sets = append(sets, fmt.Sprintf("new_sso_wage=$%d", argIdx))
		args = append(args, *newSSO)
		argIdx++
	}
	if len(sets) == 1 {
		return nil, fmt.Errorf("no fields to update")
	}
	args = append(args, id)
	setClause := strings.Join(sets, ",")
	q := fmt.Sprintf(`UPDATE salary_raise_item SET %s WHERE id=$%d RETURNING id, cycle_id, employee_id,
       (SELECT (first_name || ' ' || last_name) FROM employees e WHERE e.id = salary_raise_item.employee_id) AS employee_name,
       tenure_days, current_salary, current_sso_wage,
       raise_percent, raise_amount, new_salary, new_sso_wage,
       late_minutes, leave_days, leave_double_days, leave_hours, ot_hours,
       updated_at`, setClause, argIdx)
	var out Item
	if err := db.GetContext(ctx, &out, q, args...); err != nil {
		return nil, err
	}
	out.hydrateStats()
	return &out, nil
}
