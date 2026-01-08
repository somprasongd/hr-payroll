package dto

import (
	"time"

	"github.com/google/uuid"

	"hrms/modules/salaryadvance/internal/repository"
)

type Item struct {
	ID           uuid.UUID `json:"id"`
	EmployeeID   uuid.UUID `json:"employeeId"`
	EmployeeName string    `json:"employeeName"`
	EmployeeCode string    `json:"employeeCode"`
	Amount       float64   `json:"amount"`
	AdvanceDate  time.Time `json:"advanceDate"`
	PayrollMonth time.Time `json:"payrollMonthDate"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type Meta struct {
	CurrentPage int `json:"currentPage"`
	TotalPages  int `json:"totalPages"`
	TotalItems  int `json:"totalItems"`
}

func FromRecord(r repository.Record) Item {
	return Item{
		ID:           r.ID,
		EmployeeID:   r.EmployeeID,
		EmployeeName: r.EmployeeName,
		EmployeeCode: r.EmployeeCode,
		Amount:       r.Amount,
		AdvanceDate:  r.AdvanceDate,
		PayrollMonth: r.PayrollMonth,
		Status:       r.Status,
		CreatedAt:    r.CreatedAt,
		UpdatedAt:    r.UpdatedAt,
	}
}
