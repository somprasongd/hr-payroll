package mecompanies

import (
	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// Get my companies
// @Summary Get my companies
// @Description ดูรายการบริษัทที่ผู้ใช้เข้าถึงได้
// @Tags Me
// @Produce json
// @Security BearerAuth
// @Success 200 {object} Response
// @Failure 401
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /me/companies [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/companies", func(c fiber.Ctx) error {
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user context")
		}

		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{UserID: user.ID})
		if err != nil {
			return err
		}

		return response.JSON(c, fiber.StatusOK, fiber.Map{"data": resp})
	})
}
