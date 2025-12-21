package contracts

import (
	"time"

	"github.com/google/uuid"
)

// ===== Org Profile Commands (for company creation) =====

// CreateOrgProfileDirectCommand creates an org profile with explicit company ID
// Used when creating a new company (no tenant context available)
type CreateOrgProfileDirectCommand struct {
	CompanyID   uuid.UUID
	StartDate   time.Time
	CompanyName string
	ActorID     uuid.UUID
}

// CreateOrgProfileDirectResponse contains the created org profile ID
type CreateOrgProfileDirectResponse struct {
	ID uuid.UUID
}

// ===== Payroll Config Commands (for company creation) =====

// CreatePayrollConfigDirectCommand creates a payroll config with explicit company ID
// Used when creating a new company (no tenant context available)
type CreatePayrollConfigDirectCommand struct {
	CompanyID uuid.UUID
	StartDate time.Time
	ActorID   uuid.UUID
}

// CreatePayrollConfigDirectResponse contains the created payroll config ID
type CreatePayrollConfigDirectResponse struct {
	ID uuid.UUID
}
