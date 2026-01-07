package refresh

import (
	"time"

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
// @Description ขอ Access Token ใหม่ด้วย Refresh Token (Cookie หรือ Body)
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body RequestBody false "refresh token (optional if cookie is present)"
// @Success 200 {object} Response
// @Failure 400
// @Failure 401
// @Router /auth/refresh [post]
func NewEndpoint(router fiber.Router) {
	router.Post("/refresh", func(c fiber.Ctx) error {
		// Check cookie first (for web clients)
		refreshToken := c.Cookies("refresh_token")

		// Fall back to request body (for mobile clients)
		if refreshToken == "" {
			var req RequestBody
			if err := c.Bind().Body(&req); err != nil {
				return errs.BadRequest("invalid request body")
			}
			refreshToken = req.RefreshToken
		}

		if refreshToken == "" {
			return errs.BadRequest("refreshToken is required")
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			RefreshToken: refreshToken,
		})
		if err != nil {
			return err
		}

		// Update HttpOnly cookie with new refresh token (for web clients)
		c.Cookie(&fiber.Cookie{
			Name:     "refresh_token",
			Value:    resp.RefreshToken,
			Path:     "/api/auth",
			HTTPOnly: true,
			Secure:   true, // Set to true in production (HTTPS)
			SameSite: fiber.CookieSameSiteStrictMode,
			MaxAge:   int(30 * 24 * time.Hour / time.Second), // 30 days
		})

		return response.JSON(c, fiber.StatusOK, resp)
	})
}
