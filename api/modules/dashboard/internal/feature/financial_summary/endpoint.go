package financial_summary

import (
	"github.com/gofiber/fiber/v3"

	"hrms/modules/dashboard/internal/repository"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// RegisterFinancialSummary registers the financial summary endpoint
// @Summary Get financial summary
// @Description Get pending financial items (advances, loans, bonus cycles, etc.)
// @Tags Dashboard
// @Produce json
// @Security BearerAuth
// @Success 200 {object} FinancialSummaryResponse
// @Failure 401
// @Failure 500
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /dashboard/financial-summary [get]
func RegisterFinancialSummary(router fiber.Router, repo *repository.Repository) {
	router.Get("/financial-summary", func(c fiber.Ctx) error {
		resp, err := mediator.Send[*FinancialSummaryQuery, *FinancialSummaryResponse](c.Context(), &FinancialSummaryQuery{
			Repo: repo,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
