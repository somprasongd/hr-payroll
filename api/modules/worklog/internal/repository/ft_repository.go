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

type FTRepository struct {
	dbCtx transactor.DBTXContext
}

type FTRecord struct {
	ID         uuid.UUID  `db:"id"`
	EmployeeID uuid.UUID  `db:"employee_id"`
	EntryType  string     `db:"entry_type"`
	WorkDate   time.Time  `db:"work_date"`
	Quantity   float64    `db:"quantity"`
	Status     string     `db:"status"`
	CreatedAt  time.Time  `db:"created_at"`
	CreatedBy  uuid.UUID  `db:"created_by"`
	UpdatedAt  time.Time  `db:"updated_at"`
	UpdatedBy  uuid.UUID  `db:"updated_by"`
	DeletedAt  *time.Time `db:"deleted_at"`
}

type FTListResult struct {
	Rows  []FTRecord
	Total int
}

func NewFTRepository(dbCtx transactor.DBTXContext) FTRepository {
	return FTRepository{dbCtx: dbCtx}
}

func (r FTRepository) List(ctx context.Context, page, limit int, employeeID *uuid.UUID, status, entryType string, startDate, endDate *time.Time) (FTListResult, error) {
	db := r.dbCtx(ctx)
	offset := (page - 1) * limit
	var where []string
	var args []interface{}
	where = append(where, "wl.deleted_at IS NULL")

	if employeeID != nil {
		args = append(args, *employeeID)
		where = append(where, fmt.Sprintf("wl.employee_id = $%d", len(args)))
	}
	if s := strings.TrimSpace(status); s != "" && s != "all" {
		args = append(args, s)
		where = append(where, fmt.Sprintf("wl.status = $%d", len(args)))
	}
	if et := strings.TrimSpace(entryType); et != "" {
		args = append(args, et)
		where = append(where, fmt.Sprintf("wl.entry_type = $%d", len(args)))
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
SELECT wl.* FROM worklog_ft wl
WHERE %s
ORDER BY wl.work_date DESC, wl.created_at DESC
LIMIT $%d OFFSET $%d
`, whereClause, len(args)-1, len(args))

	rows, err := db.QueryxContext(ctx, query, args...)
	if err != nil {
		return FTListResult{}, err
	}
	defer rows.Close()

	var list []FTRecord
	for rows.Next() {
		var rec FTRecord
		if err := rows.StructScan(&rec); err != nil {
			return FTListResult{}, err
		}
		list = append(list, rec)
	}

	countArgs := args[:len(args)-2]
	countQuery := fmt.Sprintf(`SELECT COUNT(1) FROM worklog_ft wl WHERE %s`, whereClause)
	var total int
	if err := db.GetContext(ctx, &total, countQuery, countArgs...); err != nil {
		return FTListResult{}, err
	}
	return FTListResult{Rows: list, Total: total}, nil
}

func (r FTRepository) Get(ctx context.Context, id uuid.UUID) (*FTRecord, error) {
	db := r.dbCtx(ctx)
	const q = `SELECT * FROM worklog_ft WHERE id=$1 AND deleted_at IS NULL LIMIT 1`
	var rec FTRecord
	if err := db.GetContext(ctx, &rec, q, id); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r FTRepository) Insert(ctx context.Context, rec FTRecord) (*FTRecord, error) {
	db := r.dbCtx(ctx)
	const q = `
INSERT INTO worklog_ft (employee_id, entry_type, work_date, quantity, status, created_by, updated_by)
VALUES ($1,$2,$3,$4,$5,$6,$7)
RETURNING *`
	var out FTRecord
	if err := db.GetContext(ctx, &out, q,
		rec.EmployeeID, rec.EntryType, rec.WorkDate, rec.Quantity, rec.Status, rec.CreatedBy, rec.UpdatedBy); err != nil {
		return nil, err
	}
	return &out, nil
}

func (r FTRepository) Update(ctx context.Context, id uuid.UUID, rec FTRecord) (*FTRecord, error) {
	db := r.dbCtx(ctx)
	const q = `
UPDATE worklog_ft
SET entry_type=$1, work_date=$2, quantity=$3, status=$4, updated_by=$5
WHERE id=$6 AND deleted_at IS NULL
RETURNING *`
	var out FTRecord
	if err := db.GetContext(ctx, &out, q,
		rec.EntryType, rec.WorkDate, rec.Quantity, rec.Status, rec.UpdatedBy, id); err != nil {
		return nil, err
	}
	return &out, nil
}

func (r FTRepository) SoftDelete(ctx context.Context, id uuid.UUID, actor uuid.UUID) error {
	db := r.dbCtx(ctx)
	const q = `UPDATE worklog_ft SET deleted_at = now(), deleted_by=$1 WHERE id=$2 AND deleted_at IS NULL`
	res, err := db.ExecContext(ctx, q, actor, id)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func isUniqueErr(err error) bool {
	var pqErr *pq.Error
	if errors.As(err, &pqErr) {
		return pqErr.Code == "23505"
	}
	return false
}
