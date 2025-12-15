package dto

import (
	"time"

	"github.com/google/uuid"

	"hrms/modules/salaryraise/internal/repository"
)

const dateLayout = "2006-01-02"

type Cycle struct {
	ID               uuid.UUID `json:"id"`
	PeriodStart      string    `json:"periodStartDate"`
	PeriodEnd        string    `json:"periodEndDate"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
	TotalEmployees   int       `json:"totalEmployees,omitempty"`
	TotalRaiseAmount float64   `json:"totalRaiseAmount,omitempty"`
	Items            []Item    `json:"items,omitempty"`
}

type Item struct {
	ID             uuid.UUID  `json:"id"`
	EmployeeID     uuid.UUID  `json:"employeeId"`
	EmployeeName   string     `json:"employeeName,omitempty"`
	EmployeeNumber string     `json:"employeeNumber,omitempty"`
	PhotoID        *uuid.UUID `json:"photoId,omitempty"`
	TenureDays     int        `json:"tenureDays"`
	CurrentSalary  float64    `json:"currentSalary"`
	CurrentSSOWage *float64   `json:"currentSsoWage,omitempty"`
	RaisePercent   float64    `json:"raisePercent"`
	RaiseAmount    float64    `json:"raiseAmount"`
	NewSalary      float64    `json:"newSalary"`
	NewSSOWage     *float64   `json:"newSsoWage,omitempty"`
	UpdatedAt      time.Time  `json:"updatedAt"`
	Stats          Stats      `json:"stats"`
}

type Stats struct {
	LateMinutes     int     `json:"lateMinutes"`
	LeaveDays       float64 `json:"leaveDays"`
	LeaveDoubleDays float64 `json:"leaveDoubleDays"`
	LeaveHours      float64 `json:"leaveHours"`
	OtHours         float64 `json:"otHours"`
}

type Meta struct {
	CurrentPage int `json:"currentPage"`
	TotalPages  int `json:"totalPages"`
	TotalItems  int `json:"totalItems"`
}

func FromCycle(r repository.Cycle) Cycle {
	return Cycle{
		ID:               r.ID,
		PeriodStart:      r.PeriodStart.Format(dateLayout),
		PeriodEnd:        r.PeriodEnd.Format(dateLayout),
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
		EmployeeName:   r.EmployeeName,
		EmployeeNumber: r.EmployeeNumber,
		PhotoID:        r.PhotoID,
		TenureDays:     r.TenureDays,
		CurrentSalary:  r.CurrentSalary,
		CurrentSSOWage: r.CurrentSSOWage,
		RaisePercent:   r.RaisePercent,
		RaiseAmount:    r.RaiseAmount,
		NewSalary:      r.NewSalary,
		NewSSOWage:     r.NewSSOWage,
		UpdatedAt:      r.UpdatedAt,
		Stats: Stats{
			LateMinutes:     r.Stats.LateMinutes,
			LeaveDays:       r.Stats.LeaveDays,
			LeaveDoubleDays: r.Stats.LeaveDoubleDays,
			LeaveHours:      r.Stats.LeaveHours,
			OtHours:         r.Stats.OtHours,
		},
	}
}
