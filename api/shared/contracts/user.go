package contracts

import "github.com/google/uuid"

// ===== User Commands (for superadmin operations) =====

// CreateUserWithPasswordCommand creates a new user with password (handles hashing)
type CreateUserWithPasswordCommand struct {
	Username      string
	PlainPassword string
	Role          string
	ActorID       uuid.UUID
}

// CreateUserWithPasswordResponse contains the created user ID
type CreateUserWithPasswordResponse struct {
	UserID uuid.UUID `json:"userId"`
}

// AssignUserToCompanyCommand assigns a user to a company with a role
type AssignUserToCompanyCommand struct {
	UserID    uuid.UUID
	CompanyID uuid.UUID
	Role      string
	ActorID   uuid.UUID
}

// AssignUserToCompanyResponse is an empty response for assignment
type AssignUserToCompanyResponse struct{}

// AssignUserToBranchCommand assigns a user to a branch
type AssignUserToBranchCommand struct {
	UserID   uuid.UUID
	BranchID uuid.UUID
	ActorID  uuid.UUID
}

// AssignUserToBranchResponse is an empty response for assignment
type AssignUserToBranchResponse struct{}
