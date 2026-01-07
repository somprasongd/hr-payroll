package expiring

import (
	"strconv"

	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// List expiring documents
// @Summary List documents expiring soon
// @Description ดึงรายการเอกสารที่จะหมดอายุภายใน N วัน
// @Tags Employee Documents
// @Produce json
// @Security BearerAuth
// @Param days query int false "Days ahead (default 30)"
// @Success 200 {object} Response
// @Failure 401
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /documents/expiring [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/expiring", func(c fiber.Ctx) error {
		daysAhead := 30
		if d := c.Query("days"); d != "" {
			if v, err := strconv.Atoi(d); err == nil && v > 0 {
				daysAhead = v
			}
		}

		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			DaysAhead: daysAhead,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
