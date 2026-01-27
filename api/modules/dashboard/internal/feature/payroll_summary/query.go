package payroll_summary

import (
	"context"
	"database/sql"

	"go.uber.org/zap"

	"hrms/modules/dashboard/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
)

// PayrollSummaryQuery is the query for payroll summary
type PayrollSummaryQuery struct {
	Year int
}

// LatestRunDTO is the DTO for latest payroll run
type LatestRunDTO struct {
	ID               string  `json:"id"`
	PayrollMonthDate string  `json:"payrollMonthDate"`
	Status           string  `json:"status"`
	TotalNetPay      float64 `json:"totalNetPay"`
	TotalTax         float64 `json:"totalTax"`
	TotalSso         float64 `json:"totalSso"`
	TotalPf          float64 `json:"totalPf"`
	EmployeeCount    int     `json:"employeeCount"`
}

// YearlyTotalsDTO is the DTO for yearly totals
type YearlyTotalsDTO struct {
	TotalNetPay float64 `json:"totalNetPay"`
	TotalTax    float64 `json:"totalTax"`
	TotalSso    float64 `json:"totalSso"`
	TotalPf     float64 `json:"totalPf"`
}

// MonthlyBreakdownDTO is the DTO for monthly breakdown
type MonthlyBreakdownDTO struct {
	Month  string  `json:"month"`
	NetPay float64 `json:"netPay"`
	Tax    float64 `json:"tax"`
	Sso    float64 `json:"sso"`
	Pf     float64 `json:"pf"`
}

// PayrollSummaryResponse is the response for payroll summary
type PayrollSummaryResponse struct {
	Year             int                   `json:"year"`
	LatestRun        *LatestRunDTO         `json:"latestRun,omitempty"`
	YearlyTotals     YearlyTotalsDTO       `json:"yearlyTotals"`
	MonthlyBreakdown []MonthlyBreakdownDTO `json:"monthlyBreakdown"`
}

type payrollSummaryHandler struct {
	repo *repository.Repository
}

func NewPayrollSummaryHandler(repo *repository.Repository) *payrollSummaryHandler {
	return &payrollSummaryHandler{repo: repo}
}

func (h *payrollSummaryHandler) Handle(ctx context.Context, q *PayrollSummaryQuery) (*PayrollSummaryResponse, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	// Get latest payroll run
	latestRun, err := h.repo.GetLatestPayrollRun(ctx, tenant)
	if err != nil && err != sql.ErrNoRows {
		logger.FromContext(ctx).Error("failed to get latest payroll run", zap.Error(err))
		return nil, errs.Internal("failed to get latest payroll run")
	}

	// Get yearly totals
	yearlyTotals, err := h.repo.GetYearlyPayrollTotals(ctx, tenant, q.Year)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get yearly payroll totals", zap.Error(err))
		return nil, errs.Internal("failed to get yearly payroll totals")
	}

	// Get monthly breakdown
	monthlyBreakdown, err := h.repo.GetMonthlyPayrollBreakdown(ctx, tenant, q.Year)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get monthly payroll breakdown", zap.Error(err))
		return nil, errs.Internal("failed to get monthly payroll breakdown")
	}

	resp := &PayrollSummaryResponse{
		Year: q.Year,
		YearlyTotals: YearlyTotalsDTO{
			TotalNetPay: yearlyTotals.TotalNetPay,
			TotalTax:    yearlyTotals.TotalTax,
			TotalSso:    yearlyTotals.TotalSso,
			TotalPf:     yearlyTotals.TotalPf,
		},
		MonthlyBreakdown: make([]MonthlyBreakdownDTO, len(monthlyBreakdown)),
	}

	if latestRun != nil {
		resp.LatestRun = &LatestRunDTO{
			ID:               latestRun.ID.String(),
			PayrollMonthDate: latestRun.PayrollMonthDate.Format("2006-01-02"),
			Status:           latestRun.Status,
			TotalNetPay:      latestRun.TotalNetPay,
			TotalTax:         latestRun.TotalTax,
			TotalSso:         latestRun.TotalSso,
			TotalPf:          latestRun.TotalPf,
			EmployeeCount:    latestRun.EmployeeCount,
		}
	}

	for i, mb := range monthlyBreakdown {
		resp.MonthlyBreakdown[i] = MonthlyBreakdownDTO{
			Month:  mb.Month,
			NetPay: mb.NetPay,
			Tax:    mb.Tax,
			Sso:    mb.Sso,
			Pf:     mb.Pf,
		}
	}

	return resp, nil
}
