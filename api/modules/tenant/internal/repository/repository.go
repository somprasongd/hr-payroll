package repository

import (
	"context"

	"github.com/google/uuid"

	"hrms/shared/common/storage/sqldb/transactor"
)

// Repository handles tenant-related database operations
type Repository struct {
	dbCtx transactor.DBTXContext
}

// NewRepository creates a new tenant repository
func NewRepository(dbCtx transactor.DBTXContext) Repository {
	return Repository{dbCtx: dbCtx}
}

// HasCompanyAccess checks if user has access to a company
func (r Repository) HasCompanyAccess(ctx context.Context, userID, companyID uuid.UUID) bool {
	db := r.dbCtx(ctx)
	var count int
	err := db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM user_company_roles WHERE user_id = $1 AND company_id = $2`,
		userID, companyID)
	return err == nil && count > 0
}

// GetUserBranches returns branch IDs a user can access for a company
func (r Repository) GetUserBranches(ctx context.Context, userID, companyID uuid.UUID) ([]uuid.UUID, error) {
	db := r.dbCtx(ctx)
	var ids []uuid.UUID
	err := db.SelectContext(ctx, &ids,
		`SELECT branch_id FROM user_branch_access uba
		 JOIN branches b ON b.id = uba.branch_id
		 WHERE uba.user_id = $1 AND b.company_id = $2`,
		userID, companyID)
	return ids, err
}

// IsAdmin checks if user is admin for a company
func (r Repository) IsAdmin(ctx context.Context, userID, companyID uuid.UUID) bool {
	db := r.dbCtx(ctx)
	var role string
	err := db.GetContext(ctx, &role,
		`SELECT role FROM user_company_roles WHERE user_id = $1 AND company_id = $2`,
		userID, companyID)
	return err == nil && role == "admin"
}
