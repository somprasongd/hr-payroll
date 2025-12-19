package repository

import (
	"context"
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
