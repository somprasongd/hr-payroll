package payroll_summary

import (
	"strconv"
	"time"

	"github.com/gofiber/fiber/v3"

	"hrms/modules/dashboard/internal/repository"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

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
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

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
