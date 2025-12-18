package repository

import (
	"context"
	"database/sql"
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

// Branch represents a branch record
type Branch struct {
	ID        uuid.UUID `db:"id" json:"id"`
	CompanyID uuid.UUID `db:"company_id" json:"companyId"`
	Code      string    `db:"code" json:"code"`
	Name      string    `db:"name" json:"name"`
	Status    string    `db:"status" json:"status"`
	IsDefault bool      `db:"is_default" json:"isDefault"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
}

// List returns all branches for the current company
func (r Repository) List(ctx context.Context) ([]Branch, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, sql.ErrNoRows
	}

	db := r.dbCtx(ctx)
	var out []Branch
	const q = `
		SELECT id, company_id, code, name, status, is_default, created_at, updated_at
		FROM branches
		WHERE company_id = $1
		ORDER BY is_default DESC, code ASC`
	if err := db.SelectContext(ctx, &out, q, tenant.CompanyID); err != nil {
		return nil, err
	}
	return out, nil
}

// GetByID returns a single branch by ID
func (r Repository) GetByID(ctx context.Context, id uuid.UUID) (*Branch, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, sql.ErrNoRows
	}

	db := r.dbCtx(ctx)
	var out Branch
	const q = `
		SELECT id, company_id, code, name, status, is_default, created_at, updated_at
		FROM branches
		WHERE id = $1 AND company_id = $2`
	if err := db.GetContext(ctx, &out, q, id, tenant.CompanyID); err != nil {
		return nil, err
	}
	return &out, nil
}

// Create creates a new branch
func (r Repository) Create(ctx context.Context, code, name string, actor uuid.UUID) (*Branch, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, sql.ErrNoRows
	}

	db := r.dbCtx(ctx)
	const q = `
		INSERT INTO branches (company_id, code, name, status, is_default, created_by, updated_by)
		VALUES ($1, $2, $3, 'active', FALSE, $4, $4)
		RETURNING id, company_id, code, name, status, is_default, created_at, updated_at`
	var out Branch
	if err := db.GetContext(ctx, &out, q, tenant.CompanyID, code, name, actor); err != nil {
		return nil, err
	}
	return &out, nil
}

// Update updates a branch
func (r Repository) Update(ctx context.Context, id uuid.UUID, code, name, status string, actor uuid.UUID) (*Branch, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, sql.ErrNoRows
	}

	db := r.dbCtx(ctx)
	const q = `
		UPDATE branches
		SET code = $1, name = $2, status = $3, updated_by = $4, updated_at = now()
		WHERE id = $5 AND company_id = $6
		RETURNING id, company_id, code, name, status, is_default, created_at, updated_at`
	var out Branch
	if err := db.GetContext(ctx, &out, q, code, name, status, actor, id, tenant.CompanyID); err != nil {
		return nil, err
	}
	return &out, nil
}

// SetDefault sets a branch as the default for the company
func (r Repository) SetDefault(ctx context.Context, id uuid.UUID, actor uuid.UUID) error {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return sql.ErrNoRows
	}

	db := r.dbCtx(ctx)

	// First, unset all defaults for this company
	_, err := db.ExecContext(ctx,
		`UPDATE branches SET is_default = FALSE, updated_by = $1, updated_at = now() WHERE company_id = $2`,
		actor, tenant.CompanyID)
	if err != nil {
		return err
	}

	// Then set the new default
	res, err := db.ExecContext(ctx,
		`UPDATE branches SET is_default = TRUE, updated_by = $1, updated_at = now() WHERE id = $2 AND company_id = $3`,
		actor, id, tenant.CompanyID)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// Delete soft-deletes a branch (sets status to archived)
func (r Repository) Delete(ctx context.Context, id uuid.UUID, actor uuid.UUID) error {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return sql.ErrNoRows
	}

	db := r.dbCtx(ctx)

	// Check if this is the default branch
	var isDefault bool
	err := db.GetContext(ctx, &isDefault,
		`SELECT is_default FROM branches WHERE id = $1 AND company_id = $2`, id, tenant.CompanyID)
	if err != nil {
		return err
	}
	if isDefault {
		return sql.ErrNoRows // Cannot delete default branch
	}

	res, err := db.ExecContext(ctx,
		`UPDATE branches SET status = 'archived', updated_by = $1, updated_at = now() WHERE id = $2 AND company_id = $3 AND is_default = FALSE`,
		actor, id, tenant.CompanyID)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// === Tenant Repo Interface Implementation for Middleware ===

// HasCompanyAccess checks if user has access to a company
func (r Repository) HasCompanyAccess(userID, companyID uuid.UUID) bool {
	db := r.dbCtx(context.Background())
	var count int
	err := db.GetContext(context.Background(), &count,
		`SELECT COUNT(*) FROM user_company_roles WHERE user_id = $1 AND company_id = $2`,
		userID, companyID)
	return err == nil && count > 0
}

// GetUserBranches returns all branches a user can access
func (r Repository) GetUserBranches(userID, companyID uuid.UUID) ([]uuid.UUID, error) {
	db := r.dbCtx(context.Background())
	var ids []uuid.UUID
	err := db.SelectContext(context.Background(), &ids,
		`SELECT branch_id FROM user_branch_access uba
		 JOIN branches b ON b.id = uba.branch_id
		 WHERE uba.user_id = $1 AND b.company_id = $2`,
		userID, companyID)
	return ids, err
}

// IsAdmin checks if user is admin for a company
func (r Repository) IsAdmin(userID, companyID uuid.UUID) bool {
	db := r.dbCtx(context.Background())
	var role string
	err := db.GetContext(context.Background(), &role,
		`SELECT role FROM user_company_roles WHERE user_id = $1 AND company_id = $2`,
		userID, companyID)
	return err == nil && role == "admin"
}

// GetUserCompanies returns all companies a user has access to
func (r Repository) GetUserCompanies(ctx context.Context, userID uuid.UUID) ([]Company, error) {
	db := r.dbCtx(ctx)
	var out []Company
	const q = `
		SELECT c.id, c.code, c.name, c.status, ucr.role
		FROM companies c
		JOIN user_company_roles ucr ON ucr.company_id = c.id
		WHERE ucr.user_id = $1 AND c.status = 'active'
		ORDER BY c.name`
	if err := db.SelectContext(ctx, &out, q, userID); err != nil {
		return nil, err
	}
	return out, nil
}

// GetUserBranchesForCompany returns all branches for a user in a specific company
func (r Repository) GetUserBranchesForCompany(ctx context.Context, userID, companyID uuid.UUID) ([]Branch, error) {
	db := r.dbCtx(ctx)

	// Check if user is admin
	if r.IsAdmin(userID, companyID) {
		// Admin sees all branches
		var out []Branch
		const q = `
			SELECT id, company_id, code, name, status, is_default, created_at, updated_at
			FROM branches
			WHERE company_id = $1 AND status = 'active'
			ORDER BY is_default DESC, code ASC`
		if err := db.SelectContext(ctx, &out, q, companyID); err != nil {
			return nil, err
		}
		return out, nil
	}

	// Non-admin sees only assigned branches
	var out []Branch
	const q = `
		SELECT b.id, b.company_id, b.code, b.name, b.status, b.is_default, b.created_at, b.updated_at
		FROM branches b
		JOIN user_branch_access uba ON uba.branch_id = b.id
		WHERE uba.user_id = $1 AND b.company_id = $2 AND b.status = 'active'
		ORDER BY b.is_default DESC, b.code ASC`
	if err := db.SelectContext(ctx, &out, q, userID, companyID); err != nil {
		return nil, err
	}
	return out, nil
}

// Company represents a company record
type Company struct {
	ID     uuid.UUID `db:"id" json:"id"`
	Code   string    `db:"code" json:"code"`
	Name   string    `db:"name" json:"name"`
	Status string    `db:"status" json:"status"`
	Role   string    `db:"role" json:"role"`
}

// GetEmployeeCountByBranch returns the count of employees in a branch
func (r Repository) GetEmployeeCountByBranch(ctx context.Context, branchID uuid.UUID) (int, error) {
	db := r.dbCtx(ctx)
	var count int
	const q = `SELECT COUNT(*) FROM employees WHERE branch_id = $1 AND deleted_at IS NULL`
	if err := db.GetContext(ctx, &count, q, branchID); err != nil {
		return 0, err
	}
	return count, nil
}

// UpdateStatus updates only the status of a branch (for status transitions)
func (r Repository) UpdateStatus(ctx context.Context, id uuid.UUID, status string, actor uuid.UUID) (*Branch, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, sql.ErrNoRows
	}

	db := r.dbCtx(ctx)
	const q = `
		UPDATE branches
		SET status = $1, updated_by = $2, updated_at = now()
		WHERE id = $3 AND company_id = $4
		RETURNING id, company_id, code, name, status, is_default, created_at, updated_at`
	var out Branch
	if err := db.GetContext(ctx, &out, q, status, actor, id, tenant.CompanyID); err != nil {
		return nil, err
	}
	return &out, nil
}
