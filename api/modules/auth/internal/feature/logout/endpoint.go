package logout

import (
	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

type RequestBody struct {
	RefreshToken string `json:"refreshToken"`
}

// Logout endpoint
// @Summary Logout (revoke refresh token)
// @Description ยกเลิก Refresh Token ปัจจุบัน
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body RequestBody true "refresh token"
// @Success 204 "No Content"
// @Failure 400
// @Failure 401
// @Failure 403
// @Router /auth/logout [post]
func NewEndpoint(router fiber.Router) {
	router.Post("/logout", func(c fiber.Ctx) error {
		var req RequestBody
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		if _, err := mediator.Send[*Command, mediator.NoResponse](c.Context(), &Command{
			RefreshToken: req.RefreshToken,
		}); err != nil {
			return err
		}

		return c.SendStatus(fiber.StatusNoContent)
	})
}
