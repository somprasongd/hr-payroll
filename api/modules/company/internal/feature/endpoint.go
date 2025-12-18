package feature

import (
	"github.com/gofiber/fiber/v3"

	"hrms/modules/company/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/response"
)

// Register registers all company endpoints
func Register(router fiber.Router, repo repository.Repository) {
	router.Get("/current", getCurrentHandler(repo))
	router.Put("/current", updateCurrentHandler(repo))
}

// @Summary Get current company
// @Tags Company
// @Produce json
// @Security BearerAuth
// @Success 200 {object} repository.Company
// @Router /admin/company/current [get]
func getCurrentHandler(repo repository.Repository) fiber.Handler {
	return func(c fiber.Ctx) error {
		company, err := repo.GetCurrent(c.Context())
		if err != nil {
			return errs.NotFound("company not found")
		}
		if company == nil {
			return errs.BadRequest("no company context")
		}
		return response.JSON(c, fiber.StatusOK, company)
	}
}

// UpdateRequest represents the request body for updating a company
type UpdateRequest struct {
	Code string `json:"code" validate:"required,min=1,max=20"`
	Name string `json:"name" validate:"required,min=1,max=100"`
}

// @Summary Update current company
// @Tags Company
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body UpdateRequest true "company payload"
// @Success 200 {object} repository.Company
// @Router /admin/company/current [put]
func updateCurrentHandler(repo repository.Repository) fiber.Handler {
	return func(c fiber.Ctx) error {
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		var req UpdateRequest
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		if req.Code == "" || req.Name == "" {
			return errs.BadRequest("code and name are required")
		}

		company, err := repo.Update(c.Context(), req.Code, req.Name, user.ID)
		if err != nil {
			return errs.Internal("failed to update company")
		}
		return response.JSON(c, fiber.StatusOK, company)
	}
}
