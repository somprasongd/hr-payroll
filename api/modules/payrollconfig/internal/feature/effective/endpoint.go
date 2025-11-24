package effective

import (
	"time"

	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// Get effective payroll config
// @Summary Get effective payroll config
// @Description ดึง config ที่มีผล ณ วันที่ระบุ
// @Tags Payroll Config
// @Produce json
// @Param date query string false "YYYY-MM-DD"
// @Security BearerAuth
// @Success 200 {object} Response
// @Failure 404
// @Router /admin/payroll-configs/effective [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/effective", func(c fiber.Ctx) error {
		dateStr := c.Query("date")
		var dt time.Time
		var err error
		if dateStr != "" {
			dt, err = time.Parse("2006-01-02", dateStr)
			if err != nil {
				return errs.BadRequest("invalid date format")
			}
		}

		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			Date: dt,
		})
		if err != nil {
			return err
		}

		return response.JSON(c, fiber.StatusOK, resp.Config)
	})
}
