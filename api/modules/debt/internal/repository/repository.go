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

type Record struct {
	ID           uuid.UUID  `db:"id"`
	EmployeeID   uuid.UUID  `db:"employee_id"`
	TxnDate      time.Time  `db:"txn_date"`
	TxnType      string     `db:"txn_type"`
	OtherDesc    *string    `db:"other_desc"`
	Amount       float64    `db:"amount"`
	Reason       *string    `db:"reason"`
	PayrollMonth *time.Time `db:"payroll_month_date"`
	Status       string     `db:"status"`
	ParentID     *uuid.UUID `db:"parent_id"`
	CreatedAt    time.Time  `db:"created_at"`
	UpdatedAt    time.Time  `db:"updated_at"`
	DeletedAt    *time.Time `db:"deleted_at"`
}

type ListResult struct {
	Rows  []Record
	Total int
}

func (r Repository) List(ctx context.Context, page, limit int, empID *uuid.UUID, txnType, status string, startDate, endDate *time.Time) (ListResult, error) {
	offset := (page - 1) * limit
	var where []string
	var args []interface{}
	where = append(where, "deleted_at IS NULL")

	if empID != nil {
		args = append(args, *empID)
		where = append(where, fmt.Sprintf("employee_id = $%d", len(args)))
	}
	if s := strings.TrimSpace(txnType); s != "" && s != "all" {
		args = append(args, s)
		where = append(where, fmt.Sprintf("txn_type = $%d", len(args)))
	}
	if s := strings.TrimSpace(status); s != "" && s != "all" {
		args = append(args, s)
		where = append(where, fmt.Sprintf("status = $%d", len(args)))
	}
	if startDate != nil {
		args = append(args, *startDate)
		where = append(where, fmt.Sprintf("txn_date >= $%d", len(args)))
	}
	if endDate != nil {
		args = append(args, *endDate)
		where = append(where, fmt.Sprintf("txn_date <= $%d", len(args)))
	}

	whereClause := strings.Join(where, " AND ")
	args = append(args, limit, offset)

	q := fmt.Sprintf(`
SELECT * FROM debt_txn
WHERE %s
ORDER BY txn_date DESC, created_at DESC
LIMIT $%d OFFSET $%d`, whereClause, len(args)-1, len(args))

	rows, err := r.dbCtx(ctx).QueryxContext(ctx, q, args...)
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
	countQ := fmt.Sprintf(`SELECT COUNT(1) FROM debt_txn WHERE %s`, whereClause)
	var total int
	if err := r.dbCtx(ctx).GetContext(ctx, &total, countQ, countArgs...); err != nil {
		return ListResult{}, err
	}
	return ListResult{Rows: list, Total: total}, nil
}

func (r Repository) Get(ctx context.Context, id uuid.UUID) (*Record, error) {
	db := r.dbCtx(ctx)
	const q = `SELECT * FROM debt_txn WHERE id=$1 AND deleted_at IS NULL LIMIT 1`
	var rec Record
	if err := db.GetContext(ctx, &rec, q, id); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) GetInstallments(ctx context.Context, parent uuid.UUID) ([]Record, error) {
	db := r.dbCtx(ctx)
	const q = `SELECT * FROM debt_txn WHERE parent_id=$1 AND deleted_at IS NULL ORDER BY payroll_month_date`
	var rows []Record
	if err := db.SelectContext(ctx, &rows, q, parent); err != nil {
		return nil, err
	}
	return rows, nil
}

func (r Repository) InsertParent(ctx context.Context, rec Record, actor uuid.UUID) (*Record, error) {
	db := r.dbCtx(ctx)
	const q = `
INSERT INTO debt_txn (
  employee_id, txn_date, txn_type, other_desc, amount, reason, status, created_by, updated_by
) VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$7)
RETURNING *`
	var out Record
	if err := db.GetContext(ctx, &out, q,
		rec.EmployeeID, rec.TxnDate, rec.TxnType, rec.OtherDesc, rec.Amount, rec.Reason, actor); err != nil {
		return nil, err
	}
	return &out, nil
}

func (r Repository) InsertInstallments(ctx context.Context, parent uuid.UUID, employeeID uuid.UUID, rows []Record, actor uuid.UUID) error {
	db := r.dbCtx(ctx)
	const q = `
INSERT INTO debt_txn (
  employee_id, txn_date, txn_type, amount, reason, payroll_month_date, status, parent_id, created_by, updated_by
) VALUES ($1,$2,'installment',$3,$4,$5,'pending',$6,$7,$7)`
	for _, rec := range rows {
		if _, err := db.ExecContext(ctx, q,
			employeeID, rec.TxnDate, rec.Amount, rec.Reason, rec.PayrollMonth, parent, actor); err != nil {
			return err
		}
	}
	return nil
}

func (r Repository) Approve(ctx context.Context, id uuid.UUID, actor uuid.UUID) (*Record, error) {
	db := r.dbCtx(ctx)
	const q = `UPDATE debt_txn SET status='approved', updated_by=$1 WHERE id=$2 AND deleted_at IS NULL AND status='pending' RETURNING *`
	var rec Record
	if err := db.GetContext(ctx, &rec, q, actor, id); err != nil {
		return nil, err
	}
	// approve installments of this parent if pending
	const qi = `UPDATE debt_txn SET status='approved', updated_by=$1 WHERE parent_id=$2 AND status='pending' AND deleted_at IS NULL`
	_, _ = db.ExecContext(ctx, qi, actor, id)
	return &rec, nil
}

func (r Repository) InsertRepayment(ctx context.Context, rec Record, actor uuid.UUID) (*Record, error) {
	db := r.dbCtx(ctx)
	const q = `
INSERT INTO debt_txn (
  employee_id, txn_date, txn_type, amount, reason, status, created_by, updated_by
) VALUES ($1,$2,'repayment',$3,$4,'approved',$5,$5)
RETURNING *`
	var out Record
	if err := db.GetContext(ctx, &out, q, rec.EmployeeID, rec.TxnDate, rec.Amount, rec.Reason, actor); err != nil {
		return nil, err
	}
	return &out, nil
}

func (r Repository) SoftDelete(ctx context.Context, id uuid.UUID, actor uuid.UUID) error {
	db := r.dbCtx(ctx)
	const q = `UPDATE debt_txn SET deleted_at = now(), deleted_by=$1 WHERE id=$2 AND deleted_at IS NULL AND status='pending'`
	res, err := db.ExecContext(ctx, q, actor, id)
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
