package repository

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
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
	ID                   uuid.UUID  `db:"id" json:"id"`
	CompanyID            uuid.UUID  `db:"company_id" json:"company_id"`
	BranchID             uuid.UUID  `db:"branch_id" json:"branch_id"`
	EmployeeID           uuid.UUID  `db:"employee_id" json:"employee_id"`
	TxnDate              time.Time  `db:"txn_date" json:"txn_date"`
	TxnType              string     `db:"txn_type" json:"txn_type"`
	OtherDesc            *string    `db:"other_desc" json:"other_desc"`
	Amount               float64    `db:"amount" json:"amount"`
	Reason               *string    `db:"reason" json:"reason"`
	PayrollMonth         *time.Time `db:"payroll_month_date" json:"payroll_month_date"`
	Status               string     `db:"status" json:"status"`
	ParentID             *uuid.UUID `db:"parent_id" json:"parent_id"`
	CreatedAt            time.Time  `db:"created_at" json:"created_at"`
	CreatedBy            uuid.UUID  `db:"created_by" json:"created_by"`
	UpdatedAt            time.Time  `db:"updated_at" json:"updated_at"`
	UpdatedBy            uuid.UUID  `db:"updated_by" json:"updated_by"`
	DeletedAt            *time.Time `db:"deleted_at" json:"deleted_at"`
	DeletedBy            *uuid.UUID `db:"deleted_by" json:"deleted_by"`
	EmployeeName         string     `db:"employee_name" json:"employee_name"`
	EmployeeCode         string     `db:"employee_code" json:"employee_code"`
	Installments         RecordList `db:"installments" json:"installments"`
	PaymentMethod        *string    `db:"payment_method" json:"payment_method"`
	CompanyBankAccountID *uuid.UUID `db:"company_bank_account_id" json:"company_bank_account_id"`
	TransferTime         *string    `db:"transfer_time" json:"transfer_time"`
	TransferDate         *time.Time `db:"transfer_date" json:"transfer_date"`
	// Computed fields from company_bank_accounts join
	BankName          *string `db:"bank_name" json:"bank_name"`
	BankAccountNumber *string `db:"bank_account_number" json:"bank_account_number"`
}

type ListResult struct {
	Rows  []Record
	Total int
}

// RecordList supports scanning JSON aggregated installment rows.
type RecordList []Record

func (rl *RecordList) Scan(value interface{}) error {
	if value == nil {
		*rl = nil
		return nil
	}
	b, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("RecordList: cannot scan type %T", value)
	}
	dec := json.NewDecoder(bytes.NewReader(b))
	dec.UseNumber()

	var raw []map[string]interface{}
	if err := dec.Decode(&raw); err != nil {
		return err
	}

	out := make([]Record, 0, len(raw))
	for _, m := range raw {
		var rec Record

		if v, ok := m["id"].(string); ok {
			if id, err := uuid.Parse(v); err == nil {
				rec.ID = id
			}
		}
		if v, ok := m["employee_id"].(string); ok {
			if id, err := uuid.Parse(v); err == nil {
				rec.EmployeeID = id
			}
		}
		if v, ok := m["parent_id"].(string); ok && v != "" {
			if id, err := uuid.Parse(v); err == nil {
				rec.ParentID = &id
			}
		}

		if v, ok := m["txn_type"].(string); ok {
			rec.TxnType = v
		}
		if v, ok := m["other_desc"].(string); ok {
			rec.OtherDesc = &v
		}
		if v, ok := m["reason"].(string); ok {
			rec.Reason = &v
		}
		if v, ok := m["status"].(string); ok {
			rec.Status = v
		}

		if v, ok := m["amount"]; ok {
			rec.Amount = toFloat64(v)
		}

		if v, ok := m["txn_date"].(string); ok {
			if t, err := parseDateString(v); err == nil {
				rec.TxnDate = t
			}
		}
		if v, ok := m["payroll_month_date"].(string); ok && v != "" {
			if t, err := parseDateString(v); err == nil {
				rec.PayrollMonth = &t
			}
		}
		if v, ok := m["created_at"].(string); ok {
			if t, err := time.Parse(time.RFC3339, v); err == nil {
				rec.CreatedAt = t
			}
		}
		if v, ok := m["updated_at"].(string); ok {
			if t, err := time.Parse(time.RFC3339, v); err == nil {
				rec.UpdatedAt = t
			}
		}
		if v, ok := m["created_by"].(string); ok {
			if id, err := uuid.Parse(v); err == nil {
				rec.CreatedBy = id
			}
		}
		if v, ok := m["updated_by"].(string); ok {
			if id, err := uuid.Parse(v); err == nil {
				rec.UpdatedBy = id
			}
		}
		if v, ok := m["deleted_at"].(string); ok && v != "" {
			if t, err := time.Parse(time.RFC3339, v); err == nil {
				rec.DeletedAt = &t
			}
		}
		if v, ok := m["deleted_by"].(string); ok && v != "" {
			if id, err := uuid.Parse(v); err == nil {
				rec.DeletedBy = &id
			}
		}

		out = append(out, rec)
	}

	*rl = out
	return nil
}

func toFloat64(v interface{}) float64 {
	switch n := v.(type) {
	case json.Number:
		if f, err := n.Float64(); err == nil {
			return f
		}
	case float64:
		return n
	case float32:
		return float64(n)
	}
	return 0
}

func parseDateString(s string) (time.Time, error) {
	layouts := []string{time.RFC3339, "2006-01-02"}
	for _, l := range layouts {
		if t, err := time.Parse(l, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("cannot parse date: %s", s)
}

func (r Repository) fetchEmployeeBranch(ctx context.Context, tenant contextx.TenantInfo, employeeID uuid.UUID) (uuid.UUID, error) {
	db := r.dbCtx(ctx)
	q := "SELECT branch_id FROM employees WHERE id=$1 AND company_id=$2"
	args := []interface{}{employeeID, tenant.CompanyID}
	if tenant.HasBranchID() {
		q += " AND branch_id=$3"
		args = append(args, tenant.BranchID)
	}
	var branchID uuid.UUID
	if err := db.GetContext(ctx, &branchID, q, args...); err != nil {
		return uuid.Nil, err
	}
	return branchID, nil
}

func (r Repository) List(ctx context.Context, tenant contextx.TenantInfo, page, limit int, empID *uuid.UUID, txnType, status string, startDate, endDate *time.Time, hasOutstanding *bool) (ListResult, error) {
	offset := (page - 1) * limit
	var where []string
	var args []interface{}
	where = append(where, "t.deleted_at IS NULL")

	// Tenant Filter
	args = append(args, tenant.CompanyID)
	where = append(where, fmt.Sprintf("e.company_id = $%d", len(args)))

	if tenant.HasBranchID() {
		args = append(args, tenant.BranchID)
		where = append(where, fmt.Sprintf("e.branch_id = $%d", len(args)))
	}

	if empID != nil {
		args = append(args, *empID)
		where = append(where, fmt.Sprintf("t.employee_id = $%d", len(args)))
	}
	if s := strings.TrimSpace(txnType); s != "" && s != "all" {
		args = append(args, s)
		where = append(where, fmt.Sprintf("t.txn_type = $%d", len(args)))
	} else {
		// default: exclude installments to reduce noise
		where = append(where, "t.txn_type <> 'installment'")
	}
	if s := strings.TrimSpace(status); s != "" && s != "all" {
		args = append(args, s)
		where = append(where, fmt.Sprintf("t.status = $%d", len(args)))
	}
	if startDate != nil {
		args = append(args, *startDate)
		where = append(where, fmt.Sprintf("t.txn_date >= $%d", len(args)))
	}
	if endDate != nil {
		args = append(args, *endDate)
		where = append(where, fmt.Sprintf("t.txn_date <= $%d", len(args)))
	}
	if hasOutstanding != nil {
		if *hasOutstanding {
			where = append(where, "EXISTS (SELECT 1 FROM payroll_accumulation pa WHERE pa.employee_id = t.employee_id AND pa.accum_type = 'loan_outstanding' AND pa.amount > 0)")
		} else {
			where = append(where, "NOT EXISTS (SELECT 1 FROM payroll_accumulation pa WHERE pa.employee_id = t.employee_id AND pa.accum_type = 'loan_outstanding' AND pa.amount > 0)")
		}
	}

	whereClause := strings.Join(where, " AND ")
	args = append(args, limit, offset)

	q := fmt.Sprintf(`
SELECT t.*,
  e.employee_number AS employee_code,
  (SELECT (pt.name_th || emp.first_name || ' ' || emp.last_name || COALESCE(' (' || NULLIF(emp.nickname, '') || ')', '')) FROM employees emp LEFT JOIN person_title pt ON pt.id = emp.title_id WHERE emp.id = t.employee_id) AS employee_name,
  COALESCE((
    SELECT json_agg(child ORDER BY child.payroll_month_date)
    FROM debt_txn child
    WHERE child.parent_id = t.id AND child.deleted_at IS NULL
  ), '[]'::json) AS installments,
  b.name_th AS bank_name,
  cba.account_number AS bank_account_number
FROM debt_txn t
JOIN employees e ON e.id = t.employee_id
LEFT JOIN company_bank_accounts cba ON cba.id = t.company_bank_account_id
LEFT JOIN banks b ON b.id = cba.bank_id
WHERE %s
ORDER BY t.created_at DESC, t.txn_date DESC
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
	countQ := fmt.Sprintf(`SELECT COUNT(1) FROM debt_txn t JOIN employees e ON e.id = t.employee_id WHERE %s`, whereClause)
	var total int
	if err := r.dbCtx(ctx).GetContext(ctx, &total, countQ, countArgs...); err != nil {
		return ListResult{}, err
	}
	return ListResult{Rows: list, Total: total}, nil
}

func (r Repository) Get(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID) (*Record, error) {
	db := r.dbCtx(ctx)
	q := `
SELECT t.*,
  e.employee_number AS employee_code,
  (SELECT (pt.name_th || emp.first_name || ' ' || emp.last_name || COALESCE(' (' || NULLIF(emp.nickname, '') || ')', '')) FROM employees emp LEFT JOIN person_title pt ON pt.id = emp.title_id WHERE emp.id = t.employee_id) AS employee_name,
  b.name_th AS bank_name,
  cba.account_number AS bank_account_number
FROM debt_txn t
JOIN employees e ON e.id = t.employee_id
LEFT JOIN company_bank_accounts cba ON cba.id = t.company_bank_account_id
LEFT JOIN banks b ON b.id = cba.bank_id
WHERE t.id=$1 AND e.company_id=$2 AND t.deleted_at IS NULL LIMIT 1`
	args := []interface{}{id, tenant.CompanyID}
	if tenant.HasBranchID() {
		q = `
SELECT t.*,
  e.employee_number AS employee_code,
  (SELECT concat_ws(' ', pt.name_th, emp.first_name, emp.last_name) FROM employees emp LEFT JOIN person_title pt ON pt.id = emp.title_id WHERE emp.id = t.employee_id) AS employee_name,
  b.name_th AS bank_name,
  cba.account_number AS bank_account_number
FROM debt_txn t
JOIN employees e ON e.id = t.employee_id
LEFT JOIN company_bank_accounts cba ON cba.id = t.company_bank_account_id
LEFT JOIN banks b ON b.id = cba.bank_id
WHERE t.id=$1 AND e.company_id=$2 AND e.branch_id=$3 AND t.deleted_at IS NULL LIMIT 1`
		args = append(args, tenant.BranchID)
	}
	var rec Record
	if err := db.GetContext(ctx, &rec, q, args...); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) GetInstallments(ctx context.Context, tenant contextx.TenantInfo, parent uuid.UUID) ([]Record, error) {
	db := r.dbCtx(ctx)
	q := `
SELECT t.*,
  (SELECT concat_ws(' ', pt.name_th, e.first_name, e.last_name) FROM employees e LEFT JOIN person_title pt ON pt.id = e.title_id WHERE e.id = t.employee_id) AS employee_name
FROM debt_txn t
WHERE t.parent_id=$1 AND t.company_id=$2 AND t.deleted_at IS NULL
ORDER BY t.payroll_month_date`
	args := []interface{}{parent, tenant.CompanyID}
	if tenant.HasBranchID() {
		q = `
SELECT t.*,
  (SELECT concat_ws(' ', pt.name_th, e.first_name, e.last_name) FROM employees e LEFT JOIN person_title pt ON pt.id = e.title_id WHERE e.id = t.employee_id) AS employee_name
FROM debt_txn t
WHERE t.parent_id=$1 AND t.company_id=$2 AND t.branch_id=$3 AND t.deleted_at IS NULL
ORDER BY t.payroll_month_date`
		args = append(args, tenant.BranchID)
	}
	var rows []Record
	if err := db.SelectContext(ctx, &rows, q, args...); err != nil {
		return nil, err
	}
	return rows, nil
}

func (r Repository) PendingInstallmentsByEmployee(ctx context.Context, tenant contextx.TenantInfo, emp uuid.UUID) ([]Record, error) {
	db := r.dbCtx(ctx)
	q := `
SELECT t.*,
  (SELECT (pt.name_th || e.first_name || ' ' || e.last_name || COALESCE(' (' || NULLIF(e.nickname, '') || ')', '')) FROM employees e JOIN person_title pt ON pt.id = e.title_id WHERE e.id = t.employee_id) AS employee_name
FROM debt_txn t
WHERE t.employee_id=$1
  AND t.txn_type='installment'
  AND t.status='pending'
  AND t.company_id=$2
  AND t.deleted_at IS NULL
ORDER BY t.payroll_month_date`
	args := []interface{}{emp, tenant.CompanyID}
	if tenant.HasBranchID() {
		q = `
SELECT t.*,
  (SELECT (pt.name_th || e.first_name || ' ' || e.last_name) FROM employees e JOIN person_title pt ON pt.id = e.title_id WHERE e.id = t.employee_id) AS employee_name
FROM debt_txn t
WHERE t.employee_id=$1
  AND t.txn_type='installment'
  AND t.status='pending'
  AND t.company_id=$2
  AND t.branch_id=$3
  AND t.deleted_at IS NULL
ORDER BY t.payroll_month_date`
		args = append(args, tenant.BranchID)
	}
	var rows []Record
	if err := db.SelectContext(ctx, &rows, q, args...); err != nil {
		return nil, err
	}
	return rows, nil
}

func (r Repository) InsertParent(ctx context.Context, tenant contextx.TenantInfo, rec Record, actor uuid.UUID) (*Record, error) {
	db := r.dbCtx(ctx)
	branchID, err := r.fetchEmployeeBranch(ctx, tenant, rec.EmployeeID)
	if err != nil {
		return nil, err
	}
	const q = `
INSERT INTO debt_txn (
  employee_id, company_id, branch_id, txn_date, txn_type, other_desc, amount, reason, status, created_by, updated_by
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,$9)
RETURNING *`
	var out Record
	if err := db.GetContext(ctx, &out, q,
		rec.EmployeeID, tenant.CompanyID, branchID, rec.TxnDate, rec.TxnType, rec.OtherDesc, rec.Amount, rec.Reason, actor); err != nil {
		return nil, err
	}
	return &out, nil
}

func (r Repository) InsertInstallments(ctx context.Context, tenant contextx.TenantInfo, parent uuid.UUID, employeeID uuid.UUID, rows []Record, actor uuid.UUID) error {
	db := r.dbCtx(ctx)
	branchID, err := r.fetchEmployeeBranch(ctx, tenant, employeeID)
	if err != nil {
		return err
	}
	const q = `
INSERT INTO debt_txn (
  employee_id, company_id, branch_id, txn_date, txn_type, amount, reason, payroll_month_date, status, parent_id, created_by, updated_by
) VALUES ($1,$2,$3,$4,'installment',$5,$6,$7,'pending',$8,$9,$9)`
	for _, rec := range rows {
		if _, err := db.ExecContext(ctx, q,
			employeeID, tenant.CompanyID, branchID, rec.TxnDate, rec.Amount, rec.Reason, rec.PayrollMonth, parent, actor); err != nil {
			return err
		}
	}
	return nil
}

func (r Repository) Approve(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID, actor uuid.UUID) (*Record, error) {
	db := r.dbCtx(ctx)
	q := `UPDATE debt_txn SET status='approved', updated_by=$1 WHERE id=$2 AND company_id=$3 AND deleted_at IS NULL AND status='pending' RETURNING *`
	args := []interface{}{actor, id, tenant.CompanyID}
	if tenant.HasBranchID() {
		q = `UPDATE debt_txn SET status='approved', updated_by=$1 WHERE id=$2 AND company_id=$3 AND branch_id=$4 AND deleted_at IS NULL AND status='pending' RETURNING *`
		args = append(args, tenant.BranchID)
	}
	var rec Record
	if err := db.GetContext(ctx, &rec, q, args...); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) InsertRepayment(ctx context.Context, tenant contextx.TenantInfo, rec Record, actor uuid.UUID) (*Record, error) {
	db := r.dbCtx(ctx)
	branchID, err := r.fetchEmployeeBranch(ctx, tenant, rec.EmployeeID)
	if err != nil {
		return nil, err
	}
	const q = `
WITH inserted AS (
  INSERT INTO debt_txn (
    employee_id, company_id, branch_id, txn_date, txn_type, amount, reason, status, created_by, updated_by,
    payment_method, company_bank_account_id, transfer_time, transfer_date
  ) VALUES ($1, $2, $3, $4, 'repayment', $5, $6, 'pending', $7, $7, $8, $9, $10, $11)
  RETURNING *
)
SELECT i.*,
  e.employee_number AS employee_code,
  (SELECT (pt.name_th || emp.first_name || ' ' || emp.last_name || COALESCE(' (' || NULLIF(emp.nickname, '') || ')', '')) FROM employees emp LEFT JOIN person_title pt ON pt.id = emp.title_id WHERE emp.id = i.employee_id) AS employee_name,
  b.name_th AS bank_name,
  cba.account_number AS bank_account_number
FROM inserted i
JOIN employees e ON e.id = i.employee_id
LEFT JOIN company_bank_accounts cba ON cba.id = i.company_bank_account_id
LEFT JOIN banks b ON b.id = cba.bank_id`
	var out Record
	if err := db.GetContext(ctx, &out, q, rec.EmployeeID, tenant.CompanyID, branchID, rec.TxnDate, rec.Amount, rec.Reason, actor,
		rec.PaymentMethod, rec.CompanyBankAccountID, rec.TransferTime, rec.TransferDate); err != nil {
		return nil, err
	}
	return &out, nil
}

func (r Repository) SoftDelete(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID, actor uuid.UUID) error {
	db := r.dbCtx(ctx)
	q := `UPDATE debt_txn SET deleted_at = now(), deleted_by=$1 WHERE id=$2 AND company_id=$3 AND deleted_at IS NULL AND status='pending'`
	args := []interface{}{actor, id, tenant.CompanyID}
	if tenant.HasBranchID() {
		q = `UPDATE debt_txn SET deleted_at = now(), deleted_by=$1 WHERE id=$2 AND company_id=$3 AND branch_id=$4 AND deleted_at IS NULL AND status='pending'`
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

// ValidateCompanyBankAccount checks if the bank account belongs to the tenant
func (r Repository) ValidateCompanyBankAccount(ctx context.Context, tenant contextx.TenantInfo, id uuid.UUID) (bool, error) {
	db := r.dbCtx(ctx)
	var count int
	const q = `SELECT 1 FROM company_bank_accounts WHERE id = $1 AND company_id = $2`
	err := db.QueryRowContext(ctx, q, id, tenant.CompanyID).Scan(&count)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func IsUniqueViolation(err error) bool {
	var pqErr *pq.Error
	if errors.As(err, &pqErr) {
		return pqErr.Code == "23505"
	}
	return false
}
