package list

import (
	"strconv"

	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary List activity logs
// @Tags ActivityLog
// @Produce json
// @Security BearerAuth
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Page size" default(10)
// @Param action query string false "Filter by action"
// @Param entity query string false "Filter by entity"
// @Param fromDate query string false "Filter from date (YYYY-MM-DD)"
// @Param toDate query string false "Filter to date (YYYY-MM-DD)"
// @Param userName query string false "Filter by username"
// @Success 200 {object} Response
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /admin/activity-logs [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/", listHandler())
	router.Get("/latest", listHandler())
}

func listHandler() fiber.Handler {
	return func(c fiber.Ctx) error {
		page, _ := strconv.Atoi(c.Query("page", "1"))
		limit, _ := strconv.Atoi(c.Query("limit", "10"))

		if page < 1 {
			page = 1
		}
		if limit < 1 || limit > 100 {
			limit = 10
		}

		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			Page:     page,
			Limit:    limit,
			Action:   c.Query("action"),
			Entity:   c.Query("entity"),
			FromDate: c.Query("fromDate"),
			ToDate:   c.Query("toDate"),
			UserName: c.Query("userName"),
		})
		if err != nil {
			return errs.Internal("failed to list activity logs")
		}
		return response.JSON(c, fiber.StatusOK, resp)
	}
}
