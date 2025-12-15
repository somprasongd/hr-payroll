package dto

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"hrms/modules/payrollrun/internal/repository"
)

type Run struct {
	ID              uuid.UUID              `json:"id"`
	PayrollMonth    string                 `json:"payrollMonthDate"`
	PeriodStart     string                 `json:"periodStartDate"`
	PayDate         string                 `json:"payDate"`
	Status          string                 `json:"status"`
	ApprovedAt      *time.Time             `json:"approvedAt,omitempty"`
	ApprovedBy      *uuid.UUID             `json:"approvedBy,omitempty"`
	SSORateEmp      float64                `json:"socialSecurityRateEmployee"`
	SSORateEmployer float64                `json:"socialSecurityRateEmployer"`
	OrgProfile      map[string]interface{} `json:"orgProfileSnapshot,omitempty"`
	BonusYear       *int                   `json:"bonusYear,omitempty"`
	CreatedAt       time.Time              `json:"createdAt"`
	UpdatedAt       time.Time              `json:"updatedAt"`
	TotalEmployees  int                    `json:"totalEmployees,omitempty"`
	TotalNetPay     float64                `json:"totalNetPay,omitempty"`
	Totals          *RunTotals             `json:"totals,omitempty"`
}

type Meta struct {
	CurrentPage int `json:"currentPage"`
	TotalPages  int `json:"totalPages"`
	TotalItems  int `json:"totalItems"`
}

type RunTotals struct {
	TotalIncome         float64 `json:"totalIncome"`
	TotalDeduction      float64 `json:"totalDeduction"`
	TotalNetPay         float64 `json:"totalNetPay"`
	TotalTax            float64 `json:"totalTax"`
	TotalSocialSecurity float64 `json:"totalSocialSecurity"`
	TotalProvidentFund  float64 `json:"totalProvidentFund"`
}

func FromRun(r repository.Run) Run {
	var totals *RunTotals
	if r.TotalIncome != 0 || r.TotalDeduction != 0 || r.TotalNetPay != 0 ||
		r.TotalTax != 0 || r.TotalSSO != 0 || r.TotalProvidentFund != 0 {
		totals = &RunTotals{
			TotalIncome:         r.TotalIncome,
			TotalDeduction:      r.TotalDeduction,
			TotalNetPay:         r.TotalNetPay,
			TotalTax:            r.TotalTax,
			TotalSocialSecurity: r.TotalSSO,
			TotalProvidentFund:  r.TotalProvidentFund,
		}
	}
	var snapshot map[string]interface{}
	if len(r.OrgProfileSnapshot) > 0 {
		var m map[string]interface{}
		if err := json.Unmarshal(r.OrgProfileSnapshot, &m); err == nil && len(m) > 0 {
			snapshot = m
		}
	}
	return Run{
		ID:              r.ID,
		PayrollMonth:    dateOnly(r.PayrollMonth),
		PeriodStart:     dateOnly(r.PeriodStart),
		PayDate:         dateOnly(r.PayDate),
		Status:          r.Status,
		ApprovedAt:      r.ApprovedAt,
		ApprovedBy:      r.ApprovedBy,
		SSORateEmp:      r.SSORateEmp,
		SSORateEmployer: r.SSORateEmployer,
		OrgProfile:      snapshot,
		BonusYear:       r.BonusYear,
		CreatedAt:       r.CreatedAt,
		UpdatedAt:       r.UpdatedAt,
		TotalEmployees:  r.TotalEmployees,
		TotalNetPay:     r.TotalNetPay,
		Totals:          totals,
	}
}

func dateOnly(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Format("2006-01-02")
}
