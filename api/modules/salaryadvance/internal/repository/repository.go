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

type Record struct {
	ID           uuid.UUID  `db:"id"`
	CompanyID    uuid.UUID  `db:"company_id"`
	BranchID     uuid.UUID  `db:"branch_id"`
	EmployeeID   uuid.UUID  `db:"employee_id"`
	PayrollMonth time.Time  `db:"payroll_month_date"`
	AdvanceDate  time.Time  `db:"advance_date"`
	Amount       float64    `db:"amount"`
	Status       string     `db:"status"`
	CreatedAt    time.Time  `db:"created_at"`
	CreatedBy    uuid.UUID  `db:"created_by"`
	UpdatedAt    time.Time  `db:"updated_at"`
	UpdatedBy    uuid.UUID  `db:"updated_by"`
	EmployeeName string     `db:"employee_name"`
	DeletedAt    *time.Time `db:"deleted_at"`
	DeletedBy    *uuid.UUID `db:"deleted_by"`
}

type ListResult struct {
	Rows  []Record
	Total int
}

func (r Repository) List(ctx context.Context, tenant contextx.TenantInfo, page, limit int, empID *uuid.UUID, payrollMonth *time.Time, status string) (ListResult, error) {
	db := r.dbCtx(ctx)
	offset := (page - 1) * limit
	var where []string
	var args []interface{}
	where = append(where, "sa.deleted_at IS NULL")

	// Company Filter (Need JOIN)
	args = append(args, tenant.CompanyID)
	where = append(where, fmt.Sprintf("e.company_id = $%d", len(args)))

	// Branch Filter
	if tenant.HasBranchID() {
		args = append(args, tenant.BranchID)
		where = append(where, fmt.Sprintf("e.branch_id = $%d", len(args)))
	}

	if empID != nil {
		args = append(args, *empID)
		where = append(where, fmt.Sprintf("sa.employee_id = $%d", len(args)))
	}
	if payrollMonth != nil {
		args = append(args, *payrollMonth)
		where = append(where, fmt.Sprintf("sa.payroll_month_date = $%d", len(args)))
	}
	if s := strings.TrimSpace(status); s != "" {
		args = append(args, s)
		where = append(where, fmt.Sprintf("sa.status = $%d", len(args)))
	}

	whereClause := strings.Join(where, " AND ")
	args = append(args, limit, offset)

	q := fmt.Sprintf(`
SELECT sa.*,
  concat_ws(' ', pt.name_th, e.first_name, e.last_name) AS employee_name
FROM salary_advance sa
JOIN employees e ON e.id = sa.employee_id
LEFT JOIN person_title pt ON pt.id = e.title_id
WHERE %s
ORDER BY sa.advance_date DESC, sa.created_at DESC
LIMIT $%d OFFSET $%d`, whereClause, len(args)-1, len(args))

	rows, err := db.QueryxContext(ctx, q, args...)
	if err != nil {
		return ListResult{}, err
	}
	defer rows.Close()

	var list []Record
	for rows.Next() {
		var rec Record
		if err := rows.StructScan(&rec); err != nil {
			return ListResult{}, err
		}
		list = append(list, rec)
	}

	countArgs := args[:len(args)-2]
	countQ := fmt.Sprintf(`SELECT COUNT(1) FROM salary_advance sa JOIN employees e ON e.id = sa.employee_id WHERE %s`, whereClause)
	var total int
	if err := db.GetContext(ctx, &total, countQ, countArgs...); err != nil {
		return ListResult{}, err
	}
	return ListResult{Rows: list, Total: total}, nil
}

func (r Repository) Get(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID) (*Record, error) {
	db := r.dbCtx(ctx)
	q := `
SELECT sa.*,
  (SELECT concat_ws(' ', pt.name_th, e.first_name, e.last_name) FROM employees e LEFT JOIN person_title pt ON pt.id = e.title_id WHERE e.id = sa.employee_id) AS employee_name
FROM salary_advance sa
JOIN employees e ON e.id = sa.employee_id
WHERE sa.id=$1 AND e.company_id=$2 AND sa.deleted_at IS NULL
LIMIT 1`
	args := []interface{}{id, tenant.CompanyID}
	if tenant.HasBranchID() {
		q = `
SELECT sa.*,
  (SELECT concat_ws(' ', pt.name_th, e.first_name, e.last_name) FROM employees e LEFT JOIN person_title pt ON pt.id = e.title_id WHERE e.id = sa.employee_id) AS employee_name
FROM salary_advance sa
JOIN employees e ON e.id = sa.employee_id
WHERE sa.id=$1 AND e.company_id=$2 AND e.branch_id=$3 AND sa.deleted_at IS NULL
LIMIT 1`
		args = append(args, tenant.BranchID)
	}
	var rec Record
	if err := db.GetContext(ctx, &rec, q, args...); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) Create(ctx context.Context, tenant contextx.TenantInfo, rec Record, actor uuid.UUID) (*Record, error) {
	db := r.dbCtx(ctx)
	// Validate employee belongs to tenant and capture branch
	var branchID uuid.UUID
	q := "SELECT branch_id FROM employees WHERE id=$1 AND company_id=$2"
	args := []interface{}{rec.EmployeeID, tenant.CompanyID}
	if tenant.HasBranchID() {
		q += " AND branch_id=$3"
		args = append(args, tenant.BranchID)
	}
	if err := db.GetContext(ctx, &branchID, q, args...); err != nil {
		return nil, err
	}

	const insertQ = `
INSERT INTO salary_advance (
  employee_id, company_id, branch_id, payroll_month_date, advance_date, amount, status,
  created_by, updated_by
) VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$7)
RETURNING *`
	var out Record
	if err := db.GetContext(ctx, &out, insertQ, rec.EmployeeID, tenant.CompanyID, branchID, rec.PayrollMonth, rec.AdvanceDate, rec.Amount, actor); err != nil {
		return nil, err
	}
	return &out, nil
}

func (r Repository) Update(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID, rec Record, actor uuid.UUID) (*Record, error) {
	db := r.dbCtx(ctx)
	q := `
UPDATE salary_advance
SET advance_date=$1, payroll_month_date=$2, amount=$3, updated_by=$4
FROM employees e
WHERE salary_advance.id=$5 AND salary_advance.employee_id = e.id AND e.company_id=$6 
  AND salary_advance.deleted_at IS NULL AND salary_advance.status='pending'
RETURNING salary_advance.*`
	args := []interface{}{rec.AdvanceDate, rec.PayrollMonth, rec.Amount, actor, id, tenant.CompanyID}
	if tenant.HasBranchID() {
		q = `
UPDATE salary_advance
SET advance_date=$1, payroll_month_date=$2, amount=$3, updated_by=$4
FROM employees e
WHERE salary_advance.id=$5 AND salary_advance.employee_id = e.id AND e.company_id=$6 AND e.branch_id=$7
  AND salary_advance.deleted_at IS NULL AND salary_advance.status='pending'
RETURNING salary_advance.*`
		args = append(args, tenant.BranchID)
	}
	var out Record
	if err := db.GetContext(ctx, &out, q, args...); err != nil {
		return nil, err
	}
	return &out, nil
}

func (r Repository) SoftDelete(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID, actor uuid.UUID) error {
	db := r.dbCtx(ctx)
	q := `
UPDATE salary_advance
SET deleted_at = now(), deleted_by=$1
FROM employees e
WHERE salary_advance.id=$2 AND salary_advance.employee_id = e.id AND e.company_id=$3
  AND salary_advance.deleted_at IS NULL AND salary_advance.status='pending'`
	args := []interface{}{actor, id, tenant.CompanyID}
	if tenant.HasBranchID() {
		q = `
UPDATE salary_advance
SET deleted_at = now(), deleted_by=$1
FROM employees e
WHERE salary_advance.id=$2 AND salary_advance.employee_id = e.id AND e.company_id=$3 AND e.branch_id=$4
  AND salary_advance.deleted_at IS NULL AND salary_advance.status='pending'`
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

func IsUniqueViolation(err error) bool {
	var pqErr *pq.Error
	if errors.As(err, &pqErr) {
		return pqErr.Code == "23505"
	}
	return false
}
