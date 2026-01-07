package superadminfilteroptions

import (
	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary Get filter options for system activity logs (super admin)
// @Tags SuperAdmin ActivityLog
// @Produce json
// @Security BearerAuth
// @Success 200 {object} Response
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /super-admin/activity-logs/filter-options [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/filter-options", handler())
}

func handler() fiber.Handler {
	return func(c fiber.Ctx) error {
		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{})
		if err != nil {
			return errs.Internal("failed to get filter options")
		}
		return response.JSON(c, fiber.StatusOK, resp)
	}
}
