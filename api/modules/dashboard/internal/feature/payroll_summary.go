package feature

import (
	"context"
	"database/sql"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v3"
	"go.uber.org/zap"

	"hrms/modules/dashboard/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// PayrollSummaryQuery is the query for payroll summary
type PayrollSummaryQuery struct {
	Year int
	Repo *repository.Repository
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

type payrollSummaryHandler struct{}

func NewPayrollSummaryHandler() *payrollSummaryHandler {
	return &payrollSummaryHandler{}
}

func (h *payrollSummaryHandler) Handle(ctx context.Context, q *PayrollSummaryQuery) (*PayrollSummaryResponse, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	// Get latest payroll run
	latestRun, err := q.Repo.GetLatestPayrollRun(ctx, tenant)
	if err != nil && err != sql.ErrNoRows {
		logger.FromContext(ctx).Error("failed to get latest payroll run", zap.Error(err))
		return nil, errs.Internal("failed to get latest payroll run")
	}

	// Get yearly totals
	yearlyTotals, err := q.Repo.GetYearlyPayrollTotals(ctx, tenant, q.Year)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get yearly payroll totals", zap.Error(err))
		return nil, errs.Internal("failed to get yearly payroll totals")
	}

	// Get monthly breakdown
	monthlyBreakdown, err := q.Repo.GetMonthlyPayrollBreakdown(ctx, tenant, q.Year)
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

// RegisterPayrollSummary registers the payroll summary endpoint
// @Summary Get payroll summary
// @Description Get payroll statistics including latest run and yearly totals
// @Tags Dashboard
// @Produce json
// @Param year query int false "Year (default: current year)"
// @Security BearerAuth
// @Success 200 {object} PayrollSummaryResponse
// @Failure 401
// @Failure 500
// @Router /dashboard/payroll-summary [get]
func RegisterPayrollSummary(router fiber.Router, repo *repository.Repository) {
	router.Get("/payroll-summary", func(c fiber.Ctx) error {
		year := time.Now().Year()
		if yearStr := c.Query("year"); yearStr != "" {
			if y, err := strconv.Atoi(yearStr); err == nil && y > 2000 && y < 2100 {
				year = y
			}
		}

		resp, err := mediator.Send[*PayrollSummaryQuery, *PayrollSummaryResponse](c.Context(), &PayrollSummaryQuery{
			Year: year,
			Repo: repo,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
