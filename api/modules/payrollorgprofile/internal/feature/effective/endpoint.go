package effective

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// Get effective payroll org profile
// @Summary Get effective payroll org profile
// @Description ดึงโปรไฟล์หัวสลิปที่มีผล ณ วันที่ระบุ
// @Tags Payroll Org Profile
// @Produce json
// @Param date query string false "YYYY-MM-DD"
// @Security BearerAuth
// @Success 200 {object} Response
// @Failure 404
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /admin/payroll-org-profiles/effective [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/effective", func(c fiber.Ctx) error {
		rawDate := strings.TrimSpace(c.Query("date"))
		dt := time.Now()
		if rawDate != "" && !isNilLike(rawDate) {
			parsed, err := time.Parse("2006-01-02", rawDate)
			if err != nil {
				return errs.BadRequest("invalid date format")
			}
			dt = parsed
		}

		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			Date: dt,
		})
		if err != nil {
			return err
		}

		return response.JSON(c, fiber.StatusOK, resp.Profile)
	})
}

func isNilLike(s string) bool {
	ls := strings.ToLower(strings.TrimSpace(s))
	return ls == "null" || ls == "undefined"
}
