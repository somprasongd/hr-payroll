package contracts

import (
	"time"

	"github.com/google/uuid"
)

// ===== Company Models =====

// CompanyDTO represents a company for cross-module communication
type CompanyDTO struct {
	ID        uuid.UUID `json:"id"`
	Code      string    `json:"code"`
	Name      string    `json:"name"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// BranchDTO represents a branch for cross-module communication
type BranchDTO struct {
	ID        uuid.UUID `json:"id"`
	CompanyID uuid.UUID `json:"companyId"`
	Code      string    `json:"code"`
	Name      string    `json:"name"`
	Status    string    `json:"status"`
	IsDefault bool      `json:"isDefault"`
}

// ===== Company Queries =====

// ListAllCompaniesQuery lists all companies (superadmin only, no tenant filter)
type ListAllCompaniesQuery struct{}

// ListAllCompaniesResponse contains all companies
type ListAllCompaniesResponse struct {
	Companies []CompanyDTO `json:"companies"`
}

// GetCompanyByIDQuery gets a company by ID (no tenant filter)
type GetCompanyByIDQuery struct {
	ID uuid.UUID
}

// GetCompanyByIDResponse contains the company
type GetCompanyByIDResponse struct {
	Company *CompanyDTO `json:"company"`
}

// ===== Company Commands =====

// CreateCompanyCommand creates a new company
type CreateCompanyCommand struct {
	Code    string
	Name    string
	ActorID uuid.UUID
}

// CreateCompanyResponse contains the created company
type CreateCompanyResponse struct {
	Company *CompanyDTO `json:"company"`
}

// UpdateCompanyByIDCommand updates a company by ID (no tenant filter)
type UpdateCompanyByIDCommand struct {
	ID      uuid.UUID
	Code    string
	Name    string
	Status  string
	ActorID uuid.UUID
}

// UpdateCompanyByIDResponse contains the updated company
type UpdateCompanyByIDResponse struct {
	Company *CompanyDTO `json:"company"`
}

// CreateDefaultBranchCommand creates a default branch for a company
type CreateDefaultBranchCommand struct {
	CompanyID uuid.UUID
	ActorID   uuid.UUID
}

// CreateDefaultBranchResponse contains the created branch
type CreateDefaultBranchResponse struct {
	Branch *BranchDTO `json:"branch"`
}
