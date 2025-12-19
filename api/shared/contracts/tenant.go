package contracts

import "github.com/google/uuid"

// ===== Tenant Queries =====

// HasCompanyAccessQuery checks if a user has access to a company
type HasCompanyAccessQuery struct {
	UserID    uuid.UUID
	CompanyID uuid.UUID
}

// HasCompanyAccessResponse contains the result
type HasCompanyAccessResponse struct {
	HasAccess bool
}

// GetUserBranchesQuery gets branch IDs a user can access for a company
type GetUserBranchesQuery struct {
	UserID    uuid.UUID
	CompanyID uuid.UUID
}

// GetUserBranchesResponse contains the branch IDs
type GetUserBranchesResponse struct {
	BranchIDs []uuid.UUID
}

// IsAdminQuery checks if a user is admin for a company
type IsAdminQuery struct {
	UserID    uuid.UUID
	CompanyID uuid.UUID
}

// IsAdminResponse contains the result
type IsAdminResponse struct {
	IsAdmin bool
}
