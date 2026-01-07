package logout

import (
	"time"

	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

type RequestBody struct {
	RefreshToken string `json:"refreshToken"`
}

// Logout endpoint
// @Summary Logout (revoke refresh token)
// @Description ยกเลิก Refresh Token ปัจจุบัน (Cookie หรือ Body)
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body RequestBody false "refresh token (optional if cookie is present)"
// @Success 204 "No Content"
// @Failure 400
// @Failure 401
// @Failure 403
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /auth/logout [post]
func NewEndpoint(router fiber.Router) {
	router.Post("/logout", func(c fiber.Ctx) error {
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

		if _, err := mediator.Send[*Command, mediator.NoResponse](c.Context(), &Command{
			RefreshToken: refreshToken,
		}); err != nil {
			return err
		}

		// Clear the HttpOnly cookie (for web clients)
		c.Cookie(&fiber.Cookie{
			Name:     "refresh_token",
			Value:    "",
			Path:     "/",
			HTTPOnly: true,
			Secure:   false,
			SameSite: fiber.CookieSameSiteStrictMode,
			MaxAge:   -1, // Delete cookie
			Expires:  time.Now().Add(-1 * time.Hour),
		})

		return c.SendStatus(fiber.StatusNoContent)
	})
}
