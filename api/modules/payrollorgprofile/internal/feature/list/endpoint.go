package list

import (
	"strconv"

	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// List payroll org profiles
// @Summary List payroll org profiles
// @Description ดึงประวัติโปรไฟล์หัวสลิปทั้งหมด
// @Tags Payroll Org Profile
// @Produce json
// @Param page query int false "page"
// @Param limit query int false "limit"
// @Security BearerAuth
// @Success 200 {object} Response
// @Failure 401
// @Failure 403
// @Router /admin/payroll-org-profiles [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/", func(c fiber.Ctx) error {
		page, _ := strconv.Atoi(c.Query("page", "1"))
		limit, _ := strconv.Atoi(c.Query("limit", "20"))

		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			Page:  page,
			Limit: limit,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
