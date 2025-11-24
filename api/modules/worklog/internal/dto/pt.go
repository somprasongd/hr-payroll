package dto

import (
	"time"

	"github.com/google/uuid"

	"hrms/modules/worklog/internal/repository"
)

type PTItem struct {
	ID             uuid.UUID `json:"id"`
	EmployeeID     uuid.UUID `json:"employeeId"`
	WorkDate       time.Time `json:"workDate"`
	MorningIn      *string   `json:"morningIn,omitempty"`
	MorningOut     *string   `json:"morningOut,omitempty"`
	MorningMinutes int       `json:"morningMinutes"`
	EveningIn      *string   `json:"eveningIn,omitempty"`
	EveningOut     *string   `json:"eveningOut,omitempty"`
	EveningMinutes int       `json:"eveningMinutes"`
	TotalMinutes   int       `json:"totalMinutes"`
	TotalHours     float64   `json:"totalHours"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

func FromPT(rec repository.PTRecord) PTItem {
	return PTItem{
		ID:             rec.ID,
		EmployeeID:     rec.EmployeeID,
		WorkDate:       rec.WorkDate,
		MorningIn:      rec.MorningIn,
		MorningOut:     rec.MorningOut,
		MorningMinutes: rec.MorningMinutes,
		EveningIn:      rec.EveningIn,
		EveningOut:     rec.EveningOut,
		EveningMinutes: rec.EveningMinutes,
		TotalMinutes:   rec.TotalMinutes,
		TotalHours:     rec.TotalHours,
		Status:         rec.Status,
		CreatedAt:      rec.CreatedAt,
		UpdatedAt:      rec.UpdatedAt,
	}
}
