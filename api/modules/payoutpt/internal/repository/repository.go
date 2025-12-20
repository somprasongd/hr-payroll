package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
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

type Payout struct {
	ID         uuid.UUID  `db:"id" json:"id"`
	EmployeeID uuid.UUID  `db:"employee_id" json:"employeeId"`
	Status     string     `db:"status" json:"status"`
	TotalHours float64    `db:"total_hours" json:"totalHours"`
	Amount     float64    `db:"amount_total" json:"amount"`
	ItemCount  int        `db:"item_count" json:"itemCount"`
	HourlyRate float64    `db:"hourly_rate_used" json:"hourlyRate"`
	CreatedAt  time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt  time.Time  `db:"updated_at" json:"updatedAt"`
	PaidAt     *time.Time `db:"paid_at" json:"paidAt"`
	PaidBy     *uuid.UUID `db:"paid_by" json:"paidBy"`
}

type PayoutItem struct {
	ID         uuid.UUID `db:"id" json:"id"`
	WorklogID  uuid.UUID `db:"worklog_id" json:"worklogId"`
	WorkDate   time.Time `db:"work_date" json:"workDate"`
	TotalHours float64   `db:"total_hours" json:"totalHours"`
}

type ListResult struct {
	Rows  []Payout
	Total int
}

func (r Repository) Create(ctx context.Context, tenant contextx.TenantInfo, employeeID uuid.UUID, worklogIDs []uuid.UUID, actor uuid.UUID) (*Payout, error) {
	db := r.dbCtx(ctx)

	const payoutQ = `INSERT INTO payout_pt (employee_id, hourly_rate_used, created_by, updated_by) VALUES ($1,
  (SELECT base_pay_amount FROM employees WHERE id=$1), $2, $2)
RETURNING id, employee_id, status, total_hours, amount_total, hourly_rate_used, created_at, updated_at, paid_at, paid_by,
  (SELECT COUNT(1) FROM payout_pt_item WHERE payout_id=payout_pt.id) AS item_count`

	var payout Payout
	if err := db.GetContext(ctx, &payout, payoutQ, employeeID, actor); err != nil {
		return nil, err
	}
	// insert items
	for _, wl := range worklogIDs {
		if _, err := db.ExecContext(ctx, `INSERT INTO payout_pt_item (payout_id, worklog_id) VALUES ($1,$2)`, payout.ID, wl); err != nil {
			return nil, err
		}
	}
	// reload totals after triggers
	updated, err := r.Get(ctx, tenant, payout.ID)
	if err != nil {
		return nil, err
	}
	return updated, nil
}

func (r Repository) ValidateWorklogs(ctx context.Context, employeeID uuid.UUID, ids []uuid.UUID) error {
	db := r.dbCtx(ctx)
	if len(ids) == 0 {
		return fmt.Errorf("worklogIds required")
	}
	var placeholders []string
	args := []interface{}{}
	for i, id := range ids {
		placeholders = append(placeholders, fmt.Sprintf("$%d", i+1))
		args = append(args, id)
	}
	args = append(args, employeeID)
	where := strings.Join(placeholders, ",")
	q := fmt.Sprintf(`SELECT COUNT(1) FROM worklog_pt WHERE id IN (%s) AND employee_id=$%d AND status IN ('pending','approved') AND deleted_at IS NULL`, where, len(args))
	var cnt int
	if err := db.GetContext(ctx, &cnt, q, args...); err != nil {
		return err
	}
	if cnt != len(ids) {
		return fmt.Errorf("worklogs must belong to employee and be pending/approved")
	}
	return nil
}

func (r Repository) List(ctx context.Context, tenant contextx.TenantInfo, page, limit int, employeeID *uuid.UUID, status string, startDate, endDate *time.Time) (ListResult, error) {
	db := r.dbCtx(ctx)
	offset := (page - 1) * limit
	where := "p.deleted_at IS NULL"
	var args []interface{}

	// Tenant Filter
	args = append(args, tenant.CompanyID)
	where += fmt.Sprintf(" AND e.company_id=$%d", len(args))

	if tenant.HasBranchID() {
		args = append(args, tenant.BranchID)
		where += fmt.Sprintf(" AND e.branch_id = $%d", len(args))
	}

	if employeeID != nil {
		where += fmt.Sprintf(" AND p.employee_id=$%d", len(args)+1)
		args = append(args, *employeeID)
	}
	if status != "" && status != "all" {
		where += fmt.Sprintf(" AND p.status=$%d", len(args)+1)
		args = append(args, status)
	}
	if startDate != nil {
		where += fmt.Sprintf(" AND p.created_at >= $%d", len(args)+1)
		args = append(args, *startDate)
	}
	if endDate != nil {
		where += fmt.Sprintf(" AND p.created_at <= $%d", len(args)+1)
		args = append(args, *endDate)
	}
	// pagination args appended at the end
	args = append(args, limit, offset)
	q := fmt.Sprintf(`SELECT p.id, p.employee_id, p.status, p.total_hours, p.amount_total, p.hourly_rate_used,
       p.created_at, p.updated_at, p.paid_at, p.paid_by,
       COALESCE((SELECT COUNT(1) FROM payout_pt_item i WHERE i.payout_id = p.id AND i.deleted_at IS NULL),0) AS item_count
FROM payout_pt p
JOIN employees e ON e.id = p.employee_id
WHERE %s
ORDER BY p.created_at DESC
LIMIT $%d OFFSET $%d`, where, len(args)-1, len(args))
	rows, err := db.QueryxContext(ctx, q, args...)
	if err != nil {
		return ListResult{}, err
	}
	defer rows.Close()
	var list []Payout
	for rows.Next() {
		var p Payout
		if err := rows.StructScan(&p); err != nil {
			return ListResult{}, err
		}
		list = append(list, p)
	}
	countArgs := args[:len(args)-2]
	countQ := fmt.Sprintf("SELECT COUNT(1) FROM payout_pt p JOIN employees e ON e.id = p.employee_id WHERE %s", where)
	var total int
	if err := db.GetContext(ctx, &total, countQ, countArgs...); err != nil {
		return ListResult{}, err
	}
	if list == nil {
		list = make([]Payout, 0)
	}
	return ListResult{Rows: list, Total: total}, nil
}

func (r Repository) Get(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID) (*Payout, error) {
	db := r.dbCtx(ctx)
	const q = `SELECT p.id, p.employee_id, p.status, p.total_hours, p.amount_total, p.hourly_rate_used,
       p.created_at, p.updated_at, p.paid_at, p.paid_by,
       COALESCE((SELECT COUNT(1) FROM payout_pt_item i WHERE i.payout_id = p.id AND i.deleted_at IS NULL),0) AS item_count
FROM payout_pt p
JOIN employees e ON e.id = p.employee_id
WHERE p.id=$1 AND e.company_id=$2 AND p.deleted_at IS NULL
LIMIT 1`
	var p Payout
	if err := db.GetContext(ctx, &p, q, id, tenant.CompanyID); err != nil {
		return nil, err
	}
	return &p, nil
}

func (r Repository) ListItems(ctx context.Context, payoutID uuid.UUID) ([]PayoutItem, error) {
	db := r.dbCtx(ctx)
	const q = `SELECT i.id, i.worklog_id, w.work_date, w.total_hours
FROM payout_pt_item i
JOIN worklog_pt w ON w.id = i.worklog_id
WHERE i.payout_id=$1 AND i.deleted_at IS NULL`
	var items []PayoutItem
	if err := db.SelectContext(ctx, &items, q, payoutID); err != nil {
		return nil, err
	}
	return items, nil
}

func (r Repository) MarkPaid(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID, actor uuid.UUID) (*Payout, error) {
	db := r.dbCtx(ctx)
	const q = `
UPDATE payout_pt
SET status='paid', paid_by=$1, paid_at=now()
FROM employees e
WHERE payout_pt.id=$2 AND payout_pt.employee_id = e.id AND e.company_id=$3
  AND payout_pt.deleted_at IS NULL AND payout_pt.status='to_pay'
RETURNING payout_pt.id, payout_pt.employee_id, payout_pt.status, payout_pt.total_hours, payout_pt.amount_total, payout_pt.hourly_rate_used, payout_pt.created_at, payout_pt.updated_at, payout_pt.paid_at, payout_pt.paid_by,
  COALESCE((SELECT COUNT(1) FROM payout_pt_item i WHERE i.payout_id = payout_pt.id AND i.deleted_at IS NULL),0) AS item_count`
	var p Payout
	if err := db.GetContext(ctx, &p, q, actor, id, tenant.CompanyID); err != nil {
		return nil, err
	}
	return &p, nil
}

func (r Repository) SoftDelete(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID, actor uuid.UUID) error {
	db := r.dbCtx(ctx)
	const q = `
UPDATE payout_pt
SET deleted_at=now(), deleted_by=$1
FROM employees e
WHERE payout_pt.id=$2 AND payout_pt.employee_id = e.id AND e.company_id=$3 AND payout_pt.deleted_at IS NULL`
	res, err := db.ExecContext(ctx, q, actor, id, tenant.CompanyID)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}
