package filteroptions

import (
	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary Get filter options for activity logs
// @Description Returns distinct actions and entities for filtering
// @Tags ActivityLog
// @Produce json
// @Security BearerAuth
// @Success 200 {object} Response
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /admin/activity-logs/filter-options [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/filter-options", func(c fiber.Ctx) error {
		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
