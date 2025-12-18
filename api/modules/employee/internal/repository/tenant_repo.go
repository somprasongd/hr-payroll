package repository

import (
	"context"

	"github.com/google/uuid"
)

// TenantRepo is an adapter that implements middleware.TenantRepo interface
// using the employee repository's database context
type TenantRepo struct {
	dbCtx func(context.Context) DBTX
}

// DBTX is the database interface used by the repository
type DBTX interface {
	GetContext(ctx context.Context, dest interface{}, query string, args ...interface{}) error
	SelectContext(ctx context.Context, dest interface{}, query string, args ...interface{}) error
}

func NewTenantRepo(repo Repository) TenantRepo {
	return TenantRepo{
		dbCtx: func(ctx context.Context) DBTX {
			return repo.dbCtx(ctx)
		},
	}
}

// HasCompanyAccess checks if user has access to a company
func (r TenantRepo) HasCompanyAccess(userID, companyID uuid.UUID) bool {
	db := r.dbCtx(context.Background())
	var count int
	err := db.GetContext(context.Background(), &count,
		`SELECT COUNT(*) FROM user_company_roles WHERE user_id = $1 AND company_id = $2`,
		userID, companyID)
	return err == nil && count > 0
}

// GetUserBranches returns branch IDs a user can access for a company
func (r TenantRepo) GetUserBranches(userID, companyID uuid.UUID) ([]uuid.UUID, error) {
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
func (r TenantRepo) IsAdmin(userID, companyID uuid.UUID) bool {
	db := r.dbCtx(context.Background())
	var role string
	err := db.GetContext(context.Background(), &role,
		`SELECT role FROM user_company_roles WHERE user_id = $1 AND company_id = $2`,
		userID, companyID)
	return err == nil && role == "admin"
}
