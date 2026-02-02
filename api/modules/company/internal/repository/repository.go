package repository

import (
	"context"
	"fmt"
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

// Company represents a company record
type Company struct {
	ID        uuid.UUID `db:"id" json:"id"`
	Code      string    `db:"code" json:"code"`
	Name      string    `db:"name" json:"name"`
	Status    string    `db:"status" json:"status"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
}

// Branch represents a branch record
type Branch struct {
	ID        uuid.UUID `db:"id" json:"id"`
	CompanyID uuid.UUID `db:"company_id" json:"companyId"`
	Code      string    `db:"code" json:"code"`
	Name      string    `db:"name" json:"name"`
	Status    string    `db:"status" json:"status"`
	IsDefault bool      `db:"is_default" json:"isDefault"`
}

// GetCurrent returns the current company based on tenant context
func (r Repository) GetCurrent(ctx context.Context) (*Company, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, nil
	}

	db := r.dbCtx(ctx)
	var out Company
	const q = `SELECT id, code, name, status, created_at, updated_at FROM companies WHERE id = $1`
	if err := db.GetContext(ctx, &out, q, tenant.CompanyID); err != nil {
		return nil, err
	}
	return &out, nil
}

// Update updates the current company (tenant-scoped)
func (r Repository) Update(ctx context.Context, code, name string, actor uuid.UUID) (*Company, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, nil
	}

	db := r.dbCtx(ctx)
	const q = `
		UPDATE companies
		SET code = $1, name = $2, updated_by = $3, updated_at = now()
		WHERE id = $4
		RETURNING id, code, name, status, created_at, updated_at`
	var out Company
	if err := db.GetContext(ctx, &out, q, code, name, actor, tenant.CompanyID); err != nil {
		return nil, err
	}
	return &out, nil
}

// ===== Methods for superadmin contracts (no tenant filter) =====

// ListAll returns all companies (no tenant filter)
func (r Repository) ListAll(ctx context.Context) ([]Company, error) {
	db := r.dbCtx(ctx)
	var out []Company
	const q = `SELECT id, code, name, status, created_at, updated_at 
		FROM companies ORDER BY code ASC`
	if err := db.SelectContext(ctx, &out, q); err != nil {
		return nil, err
	}
	if out == nil {
		out = []Company{}
	}
	return out, nil
}

// GetByID returns a company by ID (no tenant filter)
func (r Repository) GetByID(ctx context.Context, id uuid.UUID) (*Company, error) {
	db := r.dbCtx(ctx)
	var out Company
	const q = `SELECT id, code, name, status, created_at, updated_at 
		FROM companies WHERE id = $1`
	if err := db.GetContext(ctx, &out, q, id); err != nil {
		return nil, err
	}
	return &out, nil
}

// Create creates a new company
func (r Repository) Create(ctx context.Context, code, name string, actorID uuid.UUID) (*Company, error) {
	db := r.dbCtx(ctx)
	var out Company
	const q = `INSERT INTO companies (code, name, status, created_by, updated_by)
		VALUES ($1, $2, 'active', $3, $3)
		RETURNING id, code, name, status, created_at, updated_at`
	if err := db.GetContext(ctx, &out, q, code, name, actorID); err != nil {
		return nil, err
	}
	return &out, nil
}

// UpdateByID updates a company by ID (no tenant filter)
func (r Repository) UpdateByID(ctx context.Context, id uuid.UUID, code, name, status string, actorID uuid.UUID) (*Company, error) {
	db := r.dbCtx(ctx)
	var out Company
	const q = `UPDATE companies SET code = $2, name = $3, status = $4, updated_by = $5, updated_at = now()
		WHERE id = $1
		RETURNING id, code, name, status, created_at, updated_at`
	if err := db.GetContext(ctx, &out, q, id, code, name, status, actorID); err != nil {
		return nil, err
	}
	return &out, nil
}

// CreateDefaultBranch creates the default HQ branch for a company
func (r Repository) CreateDefaultBranch(ctx context.Context, companyID, actorID uuid.UUID) (*Branch, error) {
	db := r.dbCtx(ctx)
	var out Branch
	const q = `INSERT INTO branches (company_id, code, name, status, is_default, created_by, updated_by)
		VALUES ($1, '00000', 'สำนักงานใหญ่', 'active', TRUE, $2, $2)
		RETURNING id, company_id, code, name, status, is_default`
	if err := db.GetContext(ctx, &out, q, companyID, actorID); err != nil {
		return nil, err
	}
	return &out, nil
}

// ===== Company Bank Accounts =====

// CompanyBankAccount represents a company bank account record
type CompanyBankAccount struct {
	ID            uuid.UUID  `db:"id" json:"id"`
	CompanyID     uuid.UUID  `db:"company_id" json:"companyId"`
	BankID        uuid.UUID  `db:"bank_id" json:"bankId"`
	BranchID      *uuid.UUID `db:"branch_id" json:"branchId"` // NULL = Central Account
	AccountNumber string     `db:"account_number" json:"accountNumber"`
	AccountName   string     `db:"account_name" json:"accountName"`
	IsActive      bool       `db:"is_active" json:"isActive"`
	// Enriched fields from JOINs
	BankCode   string `db:"bank_code" json:"bankCode"`
	BankNameTH string `db:"bank_name_th" json:"bankNameTh"`
	BankNameEN string `db:"bank_name_en" json:"bankNameEn"`
	BranchName string `db:"branch_name" json:"branchName"`
}

// BankAccountFilter contains filter options for listing bank accounts
type BankAccountFilter struct {
	BranchID       *uuid.UUID // Filter by specific branch (null for central accounts)
	IncludeCentral bool       // Include central accounts (branchId = null)
	IsActive       *bool      // Filter by active status
}

// ListBankAccounts returns bank accounts for the current company with optional filters
func (r Repository) ListBankAccounts(ctx context.Context, filter *BankAccountFilter) ([]CompanyBankAccount, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, nil
	}

	db := r.dbCtx(ctx)
	var out []CompanyBankAccount

	// Build query with dynamic WHERE conditions
	query := `
SELECT 
	cba.id, cba.company_id, cba.bank_id, cba.branch_id, cba.account_number, cba.account_name, cba.is_active,
	b.code AS bank_code, b.name_th AS bank_name_th, b.name_en AS bank_name_en,
	COALESCE(br.name, '') AS branch_name
FROM company_bank_accounts cba
JOIN banks b ON b.id = cba.bank_id
LEFT JOIN branches br ON br.id = cba.branch_id
WHERE cba.company_id = $1 AND cba.deleted_at IS NULL`

	args := []interface{}{tenant.CompanyID}
	argIndex := 2

	// Apply isActive filter
	if filter != nil && filter.IsActive != nil {
		query += fmt.Sprintf(" AND cba.is_active = $%d", argIndex)
		args = append(args, *filter.IsActive)
		argIndex++
	}

	// Apply branchId filter (central accounts or specific branch)
	if filter != nil && (filter.BranchID != nil || filter.IncludeCentral) {
		if filter.BranchID != nil && filter.IncludeCentral {
			// Include both central (null) and specific branch
			query += fmt.Sprintf(" AND (cba.branch_id IS NULL OR cba.branch_id = $%d)", argIndex)
			args = append(args, *filter.BranchID)
			argIndex++
		} else if filter.BranchID != nil {
			// Only specific branch
			query += fmt.Sprintf(" AND cba.branch_id = $%d", argIndex)
			args = append(args, *filter.BranchID)
			argIndex++
		} else if filter.IncludeCentral {
			// Only central accounts
			query += " AND cba.branch_id IS NULL"
		}
	}

	query += " ORDER BY cba.branch_id IS NOT NULL, br.name, b.name_th"

	if err := db.SelectContext(ctx, &out, query, args...); err != nil {
		return nil, err
	}
	if out == nil {
		out = []CompanyBankAccount{}
	}
	return out, nil
}

// GetBankAccountByID returns a bank account by ID (tenant-scoped)
func (r Repository) GetBankAccountByID(ctx context.Context, id uuid.UUID) (*CompanyBankAccount, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, nil
	}

	db := r.dbCtx(ctx)
	var out CompanyBankAccount
	const q = `
SELECT 
	cba.id, cba.company_id, cba.bank_id, cba.branch_id, cba.account_number, cba.account_name, cba.is_active,
	b.code AS bank_code, b.name_th AS bank_name_th, b.name_en AS bank_name_en,
	COALESCE(br.name, '') AS branch_name
FROM company_bank_accounts cba
JOIN banks b ON b.id = cba.bank_id
LEFT JOIN branches br ON br.id = cba.branch_id
WHERE cba.id = $1 AND cba.company_id = $2 AND cba.deleted_at IS NULL`
	if err := db.GetContext(ctx, &out, q, id, tenant.CompanyID); err != nil {
		return nil, err
	}
	return &out, nil
}

// CreateBankAccount creates a new bank account (tenant-scoped)
func (r Repository) CreateBankAccount(ctx context.Context, bankID uuid.UUID, branchID *uuid.UUID, accountNumber, accountName string, actor uuid.UUID) (*CompanyBankAccount, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, nil
	}

	db := r.dbCtx(ctx)
	var out CompanyBankAccount
	const q = `
INSERT INTO company_bank_accounts (company_id, bank_id, branch_id, account_number, account_name, created_by, updated_by)
VALUES ($1, $2, $3, $4, $5, $6, $6)
RETURNING id, company_id, bank_id, branch_id, account_number, account_name, is_active`
	if err := db.GetContext(ctx, &out, q, tenant.CompanyID, bankID, branchID, accountNumber, accountName, actor); err != nil {
		return nil, err
	}
	return &out, nil
}

// UpdateBankAccount updates a bank account (tenant-scoped)
func (r Repository) UpdateBankAccount(ctx context.Context, id, bankID uuid.UUID, branchID *uuid.UUID, accountNumber, accountName string, isActive bool, actor uuid.UUID) (*CompanyBankAccount, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, nil
	}

	db := r.dbCtx(ctx)
	var out CompanyBankAccount
	const q = `
UPDATE company_bank_accounts
SET bank_id = $1, branch_id = $2, account_number = $3, account_name = $4, is_active = $5, updated_by = $6, updated_at = now()
WHERE id = $7 AND company_id = $8 AND deleted_at IS NULL
RETURNING id, company_id, bank_id, branch_id, account_number, account_name, is_active`
	if err := db.GetContext(ctx, &out, q, bankID, branchID, accountNumber, accountName, isActive, actor, id, tenant.CompanyID); err != nil {
		return nil, err
	}
	return &out, nil
}

// DeleteBankAccount soft deletes a bank account (tenant-scoped)
func (r Repository) DeleteBankAccount(ctx context.Context, id, actor uuid.UUID) error {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil
	}

	db := r.dbCtx(ctx)
	const q = `UPDATE company_bank_accounts SET deleted_at = now(), deleted_by = $1 WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL`
	res, err := db.ExecContext(ctx, q, actor, id, tenant.CompanyID)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return nil // Not found or already deleted
	}
	return nil
}
