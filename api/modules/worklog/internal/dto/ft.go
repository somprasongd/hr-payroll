package dto

import (
	"time"

	"github.com/google/uuid"

	"hrms/modules/worklog/internal/repository"
)

type FTItem struct {
	ID         uuid.UUID `json:"id"`
	EmployeeID uuid.UUID `json:"employeeId"`
	EntryType  string    `json:"entryType"`
	WorkDate   time.Time `json:"workDate"`
	Quantity   float64   `json:"quantity"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

func FromFT(rec repository.FTRecord) FTItem {
	return FTItem{
		ID:         rec.ID,
		EmployeeID: rec.EmployeeID,
		EntryType:  rec.EntryType,
		WorkDate:   rec.WorkDate,
		Quantity:   rec.Quantity,
		Status:     rec.Status,
		CreatedAt:  rec.CreatedAt,
		UpdatedAt:  rec.UpdatedAt,
	}
}
