package contracts

import "github.com/google/uuid"

// ===== Employee Type Change Contracts =====
// These contracts are used when changing employee type (PT <-> FT)

// HasPendingPayoutPTQuery checks if an employee has pending PT payout
type HasPendingPayoutPTQuery struct {
	EmployeeID uuid.UUID
}

// HasPendingPayoutPTResponse contains the result
type HasPendingPayoutPTResponse struct {
	HasPending bool `json:"hasPending"`
}

// AddToSalaryRaiseCycleCommand adds an employee to pending salary raise cycle
type AddToSalaryRaiseCycleCommand struct {
	EmployeeID uuid.UUID
	ActorID    uuid.UUID
}

// AddToSalaryRaiseCycleResponse contains the result
type AddToSalaryRaiseCycleResponse struct {
	Added bool `json:"added"`
}

// RemoveFromSalaryRaiseCycleCommand removes an employee from pending salary raise cycle
type RemoveFromSalaryRaiseCycleCommand struct {
	EmployeeID uuid.UUID
}

// RemoveFromSalaryRaiseCycleResponse contains the result
type RemoveFromSalaryRaiseCycleResponse struct {
	Removed bool `json:"removed"`
}

// AddToBonusCycleCommand adds an employee to pending bonus cycle
type AddToBonusCycleCommand struct {
	EmployeeID uuid.UUID
	ActorID    uuid.UUID
}

// AddToBonusCycleResponse contains the result
type AddToBonusCycleResponse struct {
	Added bool `json:"added"`
}

// RemoveFromBonusCycleCommand removes an employee from pending bonus cycle
type RemoveFromBonusCycleCommand struct {
	EmployeeID uuid.UUID
}

// RemoveFromBonusCycleResponse contains the result
type RemoveFromBonusCycleResponse struct {
	Removed bool `json:"removed"`
}
