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

// BranchAccess represents a user's branch access record
type BranchAccess struct {
	BranchID  uuid.UUID `db:"branch_id" json:"branchId"`
	Code      string    `db:"code" json:"code"`
	Name      string    `db:"name" json:"name"`
	IsDefault bool      `db:"is_default" json:"isDefault"`
}

// UserBranchInfo includes user info with branch access
type UserBranchInfo struct {
	UserID   uuid.UUID      `json:"userId"`
	Username string         `json:"username"`
	Role     string         `json:"role"`
	Branches []BranchAccess `json:"branches"`
}

// GetUserBranchAccess returns branches a user can access in the current company
func (r Repository) GetUserBranchAccess(ctx context.Context, userID uuid.UUID) ([]BranchAccess, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, nil
	}

	db := r.dbCtx(ctx)
	var out []BranchAccess
	const q = `
		SELECT b.id AS branch_id, b.code, b.name, b.is_default
		FROM branches b
		JOIN user_branch_access uba ON uba.branch_id = b.id
		WHERE uba.user_id = $1 AND b.company_id = $2 AND b.status = 'active'
		ORDER BY b.is_default DESC, b.code ASC`
	if err := db.SelectContext(ctx, &out, q, userID, tenant.CompanyID); err != nil {
		return nil, err
	}
	return out, nil
}

// SetUserBranches replaces all branch access for a user in the current company
func (r Repository) SetUserBranches(ctx context.Context, userID uuid.UUID, branchIDs []uuid.UUID, actor uuid.UUID) error {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil
	}

	db := r.dbCtx(ctx)

	// First, remove all existing access for this user in this company
	_, err := db.ExecContext(ctx, `
		DELETE FROM user_branch_access
		WHERE user_id = $1 AND branch_id IN (
			SELECT id FROM branches WHERE company_id = $2
		)`, userID, tenant.CompanyID)
	if err != nil {
		return err
	}

	// Then add the new access
	for _, branchID := range branchIDs {
		// Verify branch belongs to company
		var count int
		err := db.GetContext(ctx, &count,
			`SELECT COUNT(*) FROM branches WHERE id = $1 AND company_id = $2`,
			branchID, tenant.CompanyID)
		if err != nil || count == 0 {
			continue // Skip invalid branches
		}

		_, err = db.ExecContext(ctx, `
			INSERT INTO user_branch_access (user_id, branch_id, created_by)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id, branch_id) DO NOTHING`,
			userID, branchID, actor)
		if err != nil {
			return err
		}
	}

	return nil
}

// GetCompanyUsers returns all users in the current company
type CompanyUser struct {
	ID        uuid.UUID `db:"id" json:"id"`
	Username  string    `db:"username" json:"username"`
	Role      string    `db:"role" json:"role"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
}

func (r Repository) GetCompanyUsers(ctx context.Context) ([]CompanyUser, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, nil
	}

	db := r.dbCtx(ctx)
	var out []CompanyUser
	const q = `
		SELECT u.id, u.username, ucr.role, u.created_at
		FROM users u
		JOIN user_company_roles ucr ON ucr.user_id = u.id
		WHERE ucr.company_id = $1 AND u.deleted_at IS NULL
		ORDER BY u.username`
	if err := db.SelectContext(ctx, &out, q, tenant.CompanyID); err != nil {
		return nil, err
	}
	return out, nil
}

// === Tenant middleware helpers ===

// HasCompanyAccess checks if user has access to a company
func (r Repository) HasCompanyAccess(userID, companyID uuid.UUID) bool {
	db := r.dbCtx(context.Background())
	var count int
	err := db.GetContext(context.Background(), &count,
		`SELECT COUNT(*) FROM user_company_roles WHERE user_id = $1 AND company_id = $2`,
		userID, companyID)
	return err == nil && count > 0
}

// GetUserBranches returns branch IDs a user can access for a company (used by tenant middleware)
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
