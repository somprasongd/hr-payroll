package dto

import (
	"time"

	"github.com/google/uuid"

	"hrms/modules/bonus/internal/repository"
)

const dateLayout = "2006-01-02"

type Cycle struct {
	ID               uuid.UUID `json:"id"`
	PayrollMonth     string    `json:"payrollMonthDate"`
	BonusYear        int       `json:"bonusYear"`
	PeriodStart      string    `json:"periodStartDate"`
	PeriodEnd        string    `json:"periodEndDate"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
	TotalEmployees   int       `json:"totalEmployees,omitempty"`
	TotalBonusAmount float64   `json:"totalBonusAmount,omitempty"`
	Items            []Item    `json:"items,omitempty"`
}

type Item struct {
	ID             uuid.UUID `json:"id"`
	EmployeeID     uuid.UUID `json:"employeeId"`
	EmployeeName   string    `json:"employeeName,omitempty"`
	EmployeeNumber string    `json:"employeeNumber,omitempty"`
	PhotoID        *uuid.UUID `json:"photoId,omitempty"`
	TenureDays     int       `json:"tenureDays"`
	CurrentSalary  float64   `json:"currentSalary"`
	BonusMonths    float64   `json:"bonusMonths"`
	BonusAmount    float64   `json:"bonusAmount"`
	UpdatedAt      time.Time `json:"updatedAt"`
	Stats          Stats     `json:"stats"`
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
		PayrollMonth:     r.PayrollMonth.Format(dateLayout),
		BonusYear:        r.BonusYear,
		PeriodStart:      r.PeriodStart.Format(dateLayout),
		PeriodEnd:        r.PeriodEnd.Format(dateLayout),
		Status:           r.Status,
		CreatedAt:        r.CreatedAt,
		UpdatedAt:        r.UpdatedAt,
		TotalEmployees:   r.TotalEmployees,
		TotalBonusAmount: r.TotalBonus,
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
		BonusMonths:    r.BonusMonths,
		BonusAmount:    r.BonusAmount,
		UpdatedAt:      r.UpdatedAt,
		Stats: Stats{
			LateMinutes:     r.LateMinutes,
			LeaveDays:       r.LeaveDays,
			LeaveDoubleDays: r.LeaveDouble,
			LeaveHours:      r.LeaveHours,
			OtHours:         r.OtHours,
		},
	}
}
