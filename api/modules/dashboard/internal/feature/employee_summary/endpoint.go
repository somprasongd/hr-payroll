package employee_summary

import (
	"github.com/gofiber/fiber/v3"

	"hrms/modules/dashboard/internal/repository"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// RegisterEmployeeSummary registers the employee summary endpoint
// @Summary Get employee summary
// @Description Get aggregated employee statistics
// @Tags Dashboard
// @Produce json
// @Security BearerAuth
// @Success 200 {object} EmployeeSummaryResponse
// @Failure 401
// @Failure 500
// @Router /dashboard/employee-summary [get]
func RegisterEmployeeSummary(router fiber.Router, repo *repository.Repository) {
	router.Get("/employee-summary", func(c fiber.Ctx) error {
		resp, err := mediator.Send[*EmployeeSummaryQuery, *EmployeeSummaryResponse](c.Context(), &EmployeeSummaryQuery{
			Repo: repo,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
