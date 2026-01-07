package me

import (
	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// Get my profile
// @Summary Get my profile
// @Description ดูข้อมูลโปรไฟล์ตัวเอง
// @Tags Me
// @Produce json
// @Security BearerAuth
// @Success 200 {object} dto.User
// @Failure 401
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /me [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/", func(c fiber.Ctx) error {
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user context")
		}

		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			UserID: user.ID,
		})
		if err != nil {
			return err
		}

		return response.JSON(c, fiber.StatusOK, resp.User)
	})
}
