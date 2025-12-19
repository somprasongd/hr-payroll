package update

import (
	"github.com/gofiber/fiber/v3"

	"hrms/modules/company/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

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
func NewEndpoint(router fiber.Router, repo repository.Repository) {
	router.Put("/current", func(c fiber.Ctx) error {
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

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			Repo:    repo,
			Code:    req.Code,
			Name:    req.Name,
			ActorID: user.ID,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Company)
	})
}
