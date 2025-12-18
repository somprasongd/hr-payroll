package repository

import (
	"context"

	"github.com/google/uuid"

	"hrms/shared/common/password"
	"hrms/shared/common/storage/sqldb/transactor"
)

// Repository handles super admin database operations
type Repository struct {
	dbCtx transactor.DBTXContext
}

func New(dbCtx transactor.DBTXContext) Repository {
	return Repository{dbCtx: dbCtx}
}

// Company model
type Company struct {
	ID        uuid.UUID `db:"id" json:"id"`
	Code      string    `db:"code" json:"code"`
	Name      string    `db:"name" json:"name"`
	Status    string    `db:"status" json:"status"`
	CreatedAt string    `db:"created_at" json:"createdAt"`
	UpdatedAt string    `db:"updated_at" json:"updatedAt"`
}

// Branch model
type Branch struct {
	ID        uuid.UUID `db:"id" json:"id"`
	CompanyID uuid.UUID `db:"company_id" json:"companyId"`
	Code      string    `db:"code" json:"code"`
	Name      string    `db:"name" json:"name"`
	Status    string    `db:"status" json:"status"`
	IsDefault bool      `db:"is_default" json:"isDefault"`
}

// ListCompanies returns all companies
func (r Repository) ListCompanies(ctx context.Context) ([]Company, error) {
	db := r.dbCtx(ctx)
	var out []Company
	const q = `SELECT id, code, name, status, created_at, updated_at 
		FROM companies ORDER BY code ASC`
	if err := db.SelectContext(ctx, &out, q); err != nil {
		return nil, err
	}
	return out, nil
}

// GetCompanyByID returns a company by ID
func (r Repository) GetCompanyByID(ctx context.Context, id uuid.UUID) (*Company, error) {
	db := r.dbCtx(ctx)
	var out Company
	const q = `SELECT id, code, name, status, created_at, updated_at 
		FROM companies WHERE id = $1`
	if err := db.GetContext(ctx, &out, q, id); err != nil {
		return nil, err
	}
	return &out, nil
}

// CreateCompany creates a new company
func (r Repository) CreateCompany(ctx context.Context, code, name, createdBy string) (*Company, error) {
	db := r.dbCtx(ctx)
	var out Company
	const q = `INSERT INTO companies (code, name, status, created_by, updated_by)
		VALUES ($1, $2, 'active', $3::uuid, $3::uuid)
		RETURNING id, code, name, status, created_at, updated_at`
	if err := db.GetContext(ctx, &out, q, code, name, createdBy); err != nil {
		return nil, err
	}
	return &out, nil
}

// CreateDefaultBranch creates the default HQ branch for a company
func (r Repository) CreateDefaultBranch(ctx context.Context, companyID uuid.UUID, createdBy string) (*Branch, error) {
	db := r.dbCtx(ctx)
	var out Branch
	const q = `INSERT INTO branches (company_id, code, name, status, is_default, created_by, updated_by)
		VALUES ($1, '00000', 'สำนักงานใหญ่', 'active', TRUE, $2::uuid, $2::uuid)
		RETURNING id, company_id, code, name, status, is_default`
	if err := db.GetContext(ctx, &out, q, companyID, createdBy); err != nil {
		return nil, err
	}
	return &out, nil
}

// CreateUser creates a new user (audit with creator id)
func (r Repository) CreateUser(ctx context.Context, username, plainPassword, userRole string, createdBy uuid.UUID) (uuid.UUID, error) {
	db := r.dbCtx(ctx)

	hash, err := password.Hash(plainPassword)
	if err != nil {
		return uuid.Nil, err
	}

	var id uuid.UUID
	const q = `INSERT INTO users (username, password_hash, user_role, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $4)
		RETURNING id`
	if err := db.GetContext(ctx, &id, q, username, hash, userRole, createdBy); err != nil {
		return uuid.Nil, err
	}
	return id, nil
}

// AssignUserToCompany assigns a user to a company with a role
func (r Repository) AssignUserToCompany(ctx context.Context, userID, companyID uuid.UUID, role, createdBy string) error {
	db := r.dbCtx(ctx)
	const q = `INSERT INTO user_company_roles (user_id, company_id, role, created_by)
		VALUES ($1, $2, $3, $4::uuid)
		ON CONFLICT (user_id, company_id) DO UPDATE SET role = EXCLUDED.role`
	_, err := db.ExecContext(ctx, q, userID, companyID, role, createdBy)
	return err
}

// AssignUserToBranch assigns a user to a branch
func (r Repository) AssignUserToBranch(ctx context.Context, userID, branchID uuid.UUID, createdBy string) error {
	db := r.dbCtx(ctx)
	const q = `INSERT INTO user_branch_access (user_id, branch_id, created_by)
		VALUES ($1, $2, $3::uuid)
		ON CONFLICT DO NOTHING`
	_, err := db.ExecContext(ctx, q, userID, branchID, createdBy)
	return err
}

// UpdateCompany updates a company
func (r Repository) UpdateCompany(ctx context.Context, id uuid.UUID, code, name, status, updatedBy string) (*Company, error) {
	db := r.dbCtx(ctx)
	var out Company
	const q = `UPDATE companies SET code = $2, name = $3, status = $4, updated_by = $5::uuid, updated_at = now()
		WHERE id = $1
		RETURNING id, code, name, status, created_at, updated_at`
	if err := db.GetContext(ctx, &out, q, id, code, name, status, updatedBy); err != nil {
		return nil, err
	}
	return &out, nil
}
