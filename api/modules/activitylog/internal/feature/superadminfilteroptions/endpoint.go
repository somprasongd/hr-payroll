package superadminfilteroptions

import (
	"github.com/gofiber/fiber/v3"

	"hrms/modules/activitylog/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary Get filter options for system activity logs (super admin)
// @Tags SuperAdmin ActivityLog
// @Produce json
// @Security BearerAuth
// @Success 200 {object} Response
// @Router /super-admin/activity-logs/filter-options [get]
func NewEndpoint(router fiber.Router, repo *repository.Repository) {
	router.Get("/filter-options", handler(repo))
}

func handler(repo *repository.Repository) fiber.Handler {
	return func(c fiber.Ctx) error {
		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			Repo: repo,
		})
		if err != nil {
			return errs.Internal("failed to get filter options")
		}
		return response.JSON(c, fiber.StatusOK, resp)
	}
}
