package repository

import (
	"context"
	"database/sql"
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
	ID             uuid.UUID  `db:"id" json:"id"`
	CycleID        uuid.UUID  `db:"cycle_id" json:"cycleId"`
	EmployeeID     uuid.UUID  `db:"employee_id" json:"employeeId"`
	EmployeeName   string     `db:"employee_name" json:"employeeName"`
	EmployeeNumber string     `db:"employee_number" json:"employeeNumber"`
	PhotoID        *uuid.UUID `db:"photo_id" json:"photoId,omitempty"`
	TenureDays     int        `db:"tenure_days" json:"tenureDays"`
	CurrentSalary  float64    `db:"current_salary" json:"currentSalary"`
	CurrentSSOWage *float64   `db:"current_sso_wage" json:"currentSsoWage,omitempty"`
	RaisePercent   float64    `db:"raise_percent" json:"raisePercent"`
	RaiseAmount    float64    `db:"raise_amount" json:"raiseAmount"`
	NewSalary      float64    `db:"new_salary" json:"newSalary"`
	NewSSOWage     *float64   `db:"new_sso_wage" json:"newSsoWage,omitempty"`
	UpdatedAt      time.Time  `db:"updated_at" json:"updatedAt"`
	LateMinutes    int        `db:"late_minutes" json:"-"`
	LeaveDays      float64    `db:"leave_days" json:"-"`
	LeaveDouble    float64    `db:"leave_double_days" json:"-"`
	LeaveHours     float64    `db:"leave_hours" json:"-"`
	OtHours        float64    `db:"ot_hours" json:"-"`
	Stats          Stats      `db:"-" json:"stats"`
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

func (r Repository) List(ctx context.Context, tenant contextx.TenantInfo, page, limit int, status string, year *int) (ListResult, error) {
	db := r.dbCtx(ctx)
	offset := (page - 1) * limit
	conds := []string{"deleted_at IS NULL"}
	args := []interface{}{}

	// Company Filter
	args = append(args, tenant.CompanyID)
	conds = append(conds, fmt.Sprintf("company_id = $%d", len(args)))

	// Branch Filter
	if !tenant.IsAdmin && len(tenant.BranchIDs) > 0 {
		args = append(args, pq.Array(tenant.BranchIDs))
		conds = append(conds, fmt.Sprintf("branch_id = ANY($%d)", len(args)))
	}

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

func (r Repository) Get(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID) (*Cycle, []Item, error) {
	db := r.dbCtx(ctx)
	// Check company access
	const q = `SELECT id, period_start_date, period_end_date, status, created_at, updated_at, deleted_at 
	           FROM salary_raise_cycle WHERE id=$1 AND company_id=$2 AND deleted_at IS NULL LIMIT 1`
	var c Cycle
	if err := db.GetContext(ctx, &c, q, id, tenant.CompanyID); err != nil {
		return nil, nil, err
	}
	items, err := r.ListItems(ctx, tenant, id, "")
	if err != nil {
		return nil, nil, err
	}
	return &c, items, nil
}

func (r Repository) Create(ctx context.Context, periodStart, periodEnd time.Time, companyID, branchID, actor uuid.UUID) (*Cycle, error) {
	db := r.dbCtx(ctx)
	const q = `
INSERT INTO salary_raise_cycle (period_start_date, period_end_date, status, company_id, branch_id, created_by, updated_by)
VALUES ($1,$2,'pending',$3,$4,$5,$5)
RETURNING id, period_start_date, period_end_date, status, created_at, updated_at, deleted_at`
	var c Cycle
	if err := db.GetContext(ctx, &c, q, periodStart, periodEnd, companyID, branchID, actor); err != nil {
		return nil, err
	}
	return &c, nil
}

func (r Repository) UpdateStatus(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID, status string, actor uuid.UUID) (*Cycle, error) {
	db := r.dbCtx(ctx)
	const q = `
UPDATE salary_raise_cycle
SET status=$1, updated_by=$2
WHERE id=$3 AND company_id=$4 AND deleted_at IS NULL
RETURNING id, period_start_date, period_end_date, status, created_at, updated_at, deleted_at`
	var c Cycle
	if err := db.GetContext(ctx, &c, q, status, actor, id, tenant.CompanyID); err != nil {
		return nil, err
	}
	return &c, nil
}

func (r Repository) UpdateCycle(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID, start, end *time.Time, status *string, actor uuid.UUID) (*Cycle, error) {
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
	args = append(args, id, tenant.CompanyID)
	q := fmt.Sprintf(`
UPDATE salary_raise_cycle
SET %s
WHERE id=$%d AND company_id=$%d AND deleted_at IS NULL
RETURNING id, period_start_date, period_end_date, status, created_at, updated_at, deleted_at`, strings.Join(sets, ","), argIdx, argIdx+1)
	var c Cycle
	if err := db.GetContext(ctx, &c, q, args...); err != nil {
		return nil, err
	}
	return &c, nil
}

func (r Repository) GetItem(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID) (*Item, *Cycle, error) {
	db := r.dbCtx(ctx)
	// Join employees to check company access
	const qi = `SELECT sri.id, sri.cycle_id, sri.employee_id,
       (pt.name_th || e.first_name || ' ' || e.last_name || COALESCE(' (' || e.nickname || ')', '')) AS employee_name,
       e.employee_number AS employee_number,
       e.photo_id AS photo_id,
       sri.tenure_days, sri.current_salary, sri.current_sso_wage,
       sri.raise_percent, sri.raise_amount, sri.new_salary, sri.new_sso_wage,
       sri.late_minutes, sri.leave_days, sri.leave_double_days, sri.leave_hours, sri.ot_hours,
       sri.updated_at
FROM salary_raise_item sri
JOIN employees e ON e.id = sri.employee_id
LEFT JOIN person_title pt ON pt.id = e.title_id
WHERE sri.id=$1 AND e.company_id=$2 LIMIT 1`
	var it Item
	if err := db.GetContext(ctx, &it, qi, id, tenant.CompanyID); err != nil {
		return nil, nil, err
	}
	it.hydrateStats()
	cycle, _, err := r.Get(ctx, tenant, it.CycleID)
	if err != nil {
		return nil, nil, err
	}
	return &it, cycle, nil
}

func (r Repository) DeleteCycle(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID, actor uuid.UUID) error {
	db := r.dbCtx(ctx)
	res, err := db.ExecContext(ctx, `UPDATE salary_raise_cycle SET deleted_at=now(), deleted_by=$1 WHERE id=$2 AND company_id=$3 AND deleted_at IS NULL`, actor, id, tenant.CompanyID)
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
	where := "sri.cycle_id = $1"
	args := []interface{}{cycleID}

	// Company Filter (via employees)
	args = append(args, tenant.CompanyID)
	where += fmt.Sprintf(" AND e.company_id = $%d", len(args))

	// Branch Filter
	if !tenant.IsAdmin && len(tenant.BranchIDs) > 0 {
		args = append(args, pq.Array(tenant.BranchIDs))
		where += fmt.Sprintf(" AND e.branch_id = ANY($%d)", len(args))
	}

	fullNameExpr := "(pt.name_th || e.first_name || ' ' || e.last_name || COALESCE(' (' || e.nickname || ')', ''))"
	if s := strings.TrimSpace(search); s != "" {
		args = append(args, "%"+s+"%")
		where += fmt.Sprintf(" AND (%s ILIKE $%d)", fullNameExpr, len(args))
	}
	q := fmt.Sprintf(`SELECT sri.id, sri.cycle_id, sri.employee_id,
       %s AS employee_name,
       e.employee_number AS employee_number,
       e.photo_id AS photo_id,
       sri.tenure_days, sri.current_salary, sri.current_sso_wage,
       sri.raise_percent, sri.raise_amount, sri.new_salary, sri.new_sso_wage,
       sri.late_minutes, sri.leave_days, sri.leave_double_days, sri.leave_hours, sri.ot_hours,
       sri.updated_at
FROM salary_raise_item sri
JOIN employees e ON e.id = sri.employee_id
LEFT JOIN person_title pt ON pt.id = e.title_id
WHERE %s
ORDER BY e.employee_number ASC, employee_name`, fullNameExpr, where)
	var out []Item
	if err := db.SelectContext(ctx, &out, q, args...); err != nil {
		return nil, err
	}
	for idx := range out {
		out[idx].hydrateStats()
	}
	return out, nil
}

func (r Repository) UpdateItem(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID, percent, amount, newSSO *float64, actor uuid.UUID) (*Item, error) {
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
	args = append(args, id, tenant.CompanyID)
	setClause := strings.Join(sets, ",")
	q := fmt.Sprintf(`
UPDATE salary_raise_item 
SET %s 
FROM employees e
WHERE salary_raise_item.id=$%d AND salary_raise_item.employee_id = e.id AND e.company_id=$%d
RETURNING salary_raise_item.id, salary_raise_item.cycle_id, salary_raise_item.employee_id,
       (SELECT (pt.name_th || e.first_name || ' ' || e.last_name || COALESCE(' (' || e.nickname || ')', '')) FROM employees e LEFT JOIN person_title pt ON pt.id = e.title_id WHERE e.id = salary_raise_item.employee_id) AS employee_name,
       (SELECT photo_id FROM employees e WHERE e.id = salary_raise_item.employee_id) AS photo_id,
       salary_raise_item.tenure_days, salary_raise_item.current_salary, salary_raise_item.current_sso_wage,
       salary_raise_item.raise_percent, salary_raise_item.raise_amount, salary_raise_item.new_salary, salary_raise_item.new_sso_wage,
       salary_raise_item.late_minutes, salary_raise_item.leave_days, salary_raise_item.leave_double_days, salary_raise_item.leave_hours, salary_raise_item.ot_hours,
       salary_raise_item.updated_at`, setClause, argIdx, argIdx+1)
	var out Item
	if err := db.GetContext(ctx, &out, q, args...); err != nil {
		return nil, err
	}
	out.hydrateStats()
	return &out, nil
}
