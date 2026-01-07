package me

import (
	"github.com/gofiber/fiber/v3"

	"hrms/modules/user/internal/dto"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// User represents the user response for documentation
type User = dto.User

// @Summary Get current user profile
// @Tags Me
// @Produce json
// @Security BearerAuth
// @Success 200 {object} User
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
