package switch_tenant

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/middleware"
	"hrms/shared/common/response"
	"time"
)

type switchRequest struct {
	CompanyID string   `json:"companyId"`
	BranchIDs []string `json:"branchIds"`
}

// @Summary Switch tenant context
// @Description Switch to a different company/branch context and get new tokens
// @Tags Auth
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body switchRequest true "switch request"
// @Success 200 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /auth/switch [post]
func NewEndpoint(router fiber.Router, auth fiber.Handler) {
	// Create a sub-group with auth middleware
	switchGroup := router.Group("/switch")
	switchGroup.Use(auth)

	switchGroup.Post("", func(c fiber.Ctx) error {
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		var req switchRequest
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		companyID, err := uuid.Parse(req.CompanyID)
		if err != nil {
			return errs.BadRequest("invalid companyId")
		}

		var branchIDs []uuid.UUID
		for _, idStr := range req.BranchIDs {
			if id, err := uuid.Parse(idStr); err == nil {
				branchIDs = append(branchIDs, id)
			}
		}

		cmd := &Command{
			UserID:    user.ID,
			Username:  user.Username,
			Role:      user.Role,
			CompanyID: companyID,
			BranchIDs: branchIDs,
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), cmd)
		if err != nil {
			return err
		}

		// Set HttpOnly cookie for refresh token (for web clients)
		c.Cookie(&fiber.Cookie{
			Name:     "refresh_token",
			Value:    resp.RefreshToken,
			Path:     "/",
			HTTPOnly: true,
			Secure:   false, // Set to true in production (HTTPS)
			SameSite: fiber.CookieSameSiteStrictMode,
			MaxAge:   int(30 * 24 * time.Hour / time.Second), // 30 days
		})

		return response.JSON(c, fiber.StatusOK, resp)
	})
}

// RegisterWithAuth registers the switch endpoint with auth middleware
func RegisterWithAuth(router fiber.Router, authMiddleware fiber.Handler) {
	NewEndpoint(router, authMiddleware)
}

// Ensure middleware package is imported (for swagger doc reference)
var _ = middleware.Auth
