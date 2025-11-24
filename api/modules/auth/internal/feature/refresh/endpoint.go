package refresh

import (
	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

type RequestBody struct {
	RefreshToken string `json:"refreshToken"`
}

// Refresh endpoint
// @Summary Refresh token
// @Description ขอ Access Token ใหม่ด้วย Refresh Token
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body RequestBody true "refresh token"
// @Success 200 {object} Response
// @Failure 400
// @Failure 401
// @Router /auth/refresh [post]
func NewEndpoint(router fiber.Router) {
	router.Post("/refresh", func(c fiber.Ctx) error {
		var req RequestBody
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			RefreshToken: req.RefreshToken,
		})
		if err != nil {
			return err
		}

		return response.JSON(c, fiber.StatusOK, resp)
	})
}
