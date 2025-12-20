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

type PTRepository struct {
	dbCtx transactor.DBTXContext
}

type PTRecord struct {
	ID             uuid.UUID  `db:"id"`
	EmployeeID     uuid.UUID  `db:"employee_id"`
	WorkDate       time.Time  `db:"work_date"`
	MorningIn      *string    `db:"morning_in"`
	MorningOut     *string    `db:"morning_out"`
	MorningMinutes int        `db:"morning_minutes"`
	EveningIn      *string    `db:"evening_in"`
	EveningOut     *string    `db:"evening_out"`
	EveningMinutes int        `db:"evening_minutes"`
	TotalMinutes   int        `db:"total_minutes"`
	TotalHours     float64    `db:"total_hours"`
	Status         string     `db:"status"`
	CreatedAt      time.Time  `db:"created_at"`
	CreatedBy      uuid.UUID  `db:"created_by"`
	UpdatedAt      time.Time  `db:"updated_at"`
	UpdatedBy      uuid.UUID  `db:"updated_by"`
	DeletedAt      *time.Time `db:"deleted_at"`
	DeletedBy      *uuid.UUID `db:"deleted_by"`
}

type PTListResult struct {
	Rows  []PTRecord
	Total int
}

func NewPTRepository(dbCtx transactor.DBTXContext) PTRepository {
	return PTRepository{dbCtx: dbCtx}
}

func (r PTRepository) List(ctx context.Context, tenant contextx.TenantInfo, page, limit int, employeeID *uuid.UUID, status string, startDate, endDate *time.Time) (PTListResult, error) {
	db := r.dbCtx(ctx)
	offset := (page - 1) * limit
	var where []string
	var args []interface{}
	where = append(where, "wl.deleted_at IS NULL")

	// Tenant Filter
	args = append(args, tenant.CompanyID)
	where = append(where, fmt.Sprintf("e.company_id = $%d", len(args)))

	if tenant.HasBranchID() {
		args = append(args, tenant.BranchID)
		where = append(where, fmt.Sprintf("e.branch_id = $%d", len(args)))
	}

	if employeeID != nil {
		args = append(args, *employeeID)
		where = append(where, fmt.Sprintf("wl.employee_id = $%d", len(args)))
	}
	if s := strings.TrimSpace(status); s != "" && s != "all" {
		args = append(args, s)
		where = append(where, fmt.Sprintf("wl.status = $%d", len(args)))
	}
	if startDate != nil {
		args = append(args, *startDate)
		where = append(where, fmt.Sprintf("wl.work_date >= $%d", len(args)))
	}
	if endDate != nil {
		args = append(args, *endDate)
		where = append(where, fmt.Sprintf("wl.work_date <= $%d", len(args)))
	}

	whereClause := strings.Join(where, " AND ")
	args = append(args, limit, offset)

	query := fmt.Sprintf(`
SELECT wl.* FROM worklog_pt wl
JOIN employees e ON e.id = wl.employee_id
WHERE %s
ORDER BY wl.work_date DESC, wl.created_at DESC
LIMIT $%d OFFSET $%d`, whereClause, len(args)-1, len(args))

	rows, err := db.QueryxContext(ctx, query, args...)
	if err != nil {
		return PTListResult{}, err
	}
	defer rows.Close()

	var list []PTRecord
	for rows.Next() {
		var rec PTRecord
		if err := rows.StructScan(&rec); err != nil {
			return PTListResult{}, err
		}
		list = append(list, rec)
	}

	countArgs := args[:len(args)-2]
	countQuery := fmt.Sprintf(`SELECT COUNT(1) FROM worklog_pt wl JOIN employees e ON e.id = wl.employee_id WHERE %s`, whereClause)
	var total int
	if err := db.GetContext(ctx, &total, countQuery, countArgs...); err != nil {
		return PTListResult{}, err
	}

	return PTListResult{Rows: list, Total: total}, nil
}

func (r PTRepository) Get(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID) (*PTRecord, error) {
	db := r.dbCtx(ctx)
	const q = `
SELECT wl.* FROM worklog_pt wl
JOIN employees e ON e.id = wl.employee_id
WHERE wl.id=$1 AND e.company_id=$2 AND wl.deleted_at IS NULL LIMIT 1`
	var rec PTRecord
	if err := db.GetContext(ctx, &rec, q, id, tenant.CompanyID); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r PTRepository) ExistsActiveByEmployeeDate(ctx context.Context, employeeID uuid.UUID, workDate time.Time) (bool, error) {
	db := r.dbCtx(ctx)
	const q = `
SELECT EXISTS (
  SELECT 1 FROM worklog_pt
  WHERE employee_id=$1 AND work_date=$2 AND deleted_at IS NULL
)`
	var exists bool
	if err := db.GetContext(ctx, &exists, q, employeeID, workDate); err != nil {
		return false, err
	}
	return exists, nil
}

func (r PTRepository) Insert(ctx context.Context, tenant contextx.TenantInfo, rec PTRecord) (*PTRecord, error) {
	db := r.dbCtx(ctx)
	// Validate employee belongs to company
	var count int
	if err := db.GetContext(ctx, &count, "SELECT COUNT(1) FROM employees WHERE id=$1 AND company_id=$2", rec.EmployeeID, tenant.CompanyID); err != nil {
		return nil, err
	}
	if count == 0 {
		return nil, fmt.Errorf("employee not found in this company")
	}

	const q = `
INSERT INTO worklog_pt (
  employee_id, work_date,
  morning_in, morning_out,
  evening_in, evening_out,
  status, created_by, updated_by
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
RETURNING *`
	var out PTRecord
	if err := db.GetContext(ctx, &out, q,
		rec.EmployeeID, rec.WorkDate,
		rec.MorningIn, rec.MorningOut,
		rec.EveningIn, rec.EveningOut,
		rec.Status, rec.CreatedBy, rec.UpdatedBy,
	); err != nil {
		return nil, err
	}
	return &out, nil
}

func (r PTRepository) Update(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID, rec PTRecord) (*PTRecord, error) {
	db := r.dbCtx(ctx)
	const q = `
UPDATE worklog_pt
SET work_date=$1,
    morning_in=$2, morning_out=$3,
    evening_in=$4, evening_out=$5,
    status=$6,
    updated_by=$7
FROM employees e
WHERE worklog_pt.id=$8 AND worklog_pt.employee_id = e.id AND e.company_id=$9 AND worklog_pt.deleted_at IS NULL
RETURNING worklog_pt.*`
	var out PTRecord
	if err := db.GetContext(ctx, &out, q,
		rec.WorkDate,
		rec.MorningIn, rec.MorningOut,
		rec.EveningIn, rec.EveningOut,
		rec.Status, rec.UpdatedBy, id, tenant.CompanyID,
	); err != nil {
		return nil, err
	}
	return &out, nil
}

func (r PTRepository) SoftDelete(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID, actor uuid.UUID) error {
	db := r.dbCtx(ctx)
	const q = `
UPDATE worklog_pt
SET deleted_at=now(), deleted_by=$1
FROM employees e
WHERE worklog_pt.id=$2 AND worklog_pt.employee_id=e.id AND e.company_id=$3 AND worklog_pt.deleted_at IS NULL`
	res, err := db.ExecContext(ctx, q, actor, id, tenant.CompanyID)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func IsUniqueErrPT(err error) bool {
	var pqErr *pq.Error
	if errors.As(err, &pqErr) {
		return pqErr.Code == "23505"
	}
	return false
}
