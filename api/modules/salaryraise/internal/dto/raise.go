package dto

import (
	"time"

	"github.com/google/uuid"

	"hrms/modules/salaryraise/internal/repository"
)

type Cycle struct {
	ID               uuid.UUID `json:"id"`
	PeriodStart      time.Time `json:"periodStartDate"`
	PeriodEnd        time.Time `json:"periodEndDate"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
	TotalEmployees   int       `json:"totalEmployees,omitempty"`
	TotalRaiseAmount float64   `json:"totalRaiseAmount,omitempty"`
	Items            []Item    `json:"items,omitempty"`
}

type Item struct {
	ID             uuid.UUID `json:"id"`
	EmployeeID     uuid.UUID `json:"employeeId"`
	TenureDays     int       `json:"tenureDays"`
	CurrentSalary  float64   `json:"currentSalary"`
	CurrentSSOWage *float64  `json:"currentSsoWage,omitempty"`
	RaisePercent   float64   `json:"raisePercent"`
	RaiseAmount    float64   `json:"raiseAmount"`
	NewSalary      float64   `json:"newSalary"`
	NewSSOWage     float64   `json:"newSsoWage"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

type Meta struct {
	CurrentPage int `json:"currentPage"`
	TotalPages  int `json:"totalPages"`
	TotalItems  int `json:"totalItems"`
}

func FromCycle(r repository.Cycle) Cycle {
	return Cycle{
		ID:               r.ID,
		PeriodStart:      r.PeriodStart,
		PeriodEnd:        r.PeriodEnd,
		Status:           r.Status,
		CreatedAt:        r.CreatedAt,
		UpdatedAt:        r.UpdatedAt,
		TotalEmployees:   r.TotalEmployees,
		TotalRaiseAmount: r.TotalRaise,
	}
}

func FromItem(r repository.Item) Item {
	return Item{
		ID:             r.ID,
		EmployeeID:     r.EmployeeID,
		TenureDays:     r.TenureDays,
		CurrentSalary:  r.CurrentSalary,
		CurrentSSOWage: r.CurrentSSOWage,
		RaisePercent:   r.RaisePercent,
		RaiseAmount:    r.RaiseAmount,
		NewSalary:      r.NewSalary,
		NewSSOWage:     r.NewSSOWage,
		UpdatedAt:      r.UpdatedAt,
	}
}
