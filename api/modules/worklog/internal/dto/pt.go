package dto

import (
	"strings"
	"time"

	"github.com/google/uuid"

	"hrms/modules/worklog/internal/repository"
)

type PTItem struct {
	ID             uuid.UUID `json:"id"`
	EmployeeID     uuid.UUID `json:"employeeId"`
	WorkDate       string    `json:"workDate"`
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
	formatTime := func(val *string) *string {
		if val == nil {
			return nil
		}
		trimmed := strings.TrimSpace(*val)
		if trimmed == "" {
			return nil
		}
		// DB returns TIME as HH:MM:SS or RFC3339 with 0000-01-01 date
		layouts := []string{
			"15:04:05",
			time.RFC3339,
			"2006-01-02T15:04:05Z07:00",
		}
		for _, layout := range layouts {
			if t, err := time.Parse(layout, trimmed); err == nil {
				formatted := t.Format("15:04")
				return &formatted
			}
		}
		return &trimmed
	}

	return PTItem{
		ID:             rec.ID,
		EmployeeID:     rec.EmployeeID,
		WorkDate:       rec.WorkDate.Format("2006-01-02"),
		MorningIn:      formatTime(rec.MorningIn),
		MorningOut:     formatTime(rec.MorningOut),
		MorningMinutes: rec.MorningMinutes,
		EveningIn:      formatTime(rec.EveningIn),
		EveningOut:     formatTime(rec.EveningOut),
		EveningMinutes: rec.EveningMinutes,
		TotalMinutes:   rec.TotalMinutes,
		TotalHours:     rec.TotalHours,
		Status:         rec.Status,
		CreatedAt:      rec.CreatedAt,
		UpdatedAt:      rec.UpdatedAt,
	}
}
