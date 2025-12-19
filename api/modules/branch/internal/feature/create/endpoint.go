package create

import (
	"github.com/gofiber/fiber/v3"

	"hrms/modules/branch/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// CreateRequest represents the request body for creating a branch
type CreateRequest struct {
	Code string `json:"code" validate:"required,min=1,max=10"`
	Name string `json:"name" validate:"required,min=1,max=100"`
}

// @Summary Create a new branch
// @Tags Branches
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateRequest true "branch payload"
// @Success 201 {object} repository.Branch
// @Router /admin/branches [post]
func NewEndpoint(router fiber.Router, repo repository.Repository, eb eventbus.EventBus) {
	router.Post("/", func(c fiber.Ctx) error {
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		var req CreateRequest
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		if req.Code == "" || req.Name == "" {
			return errs.BadRequest("code and name are required")
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			Repo:    repo,
			Eb:      eb,
			Code:    req.Code,
			Name:    req.Name,
			ActorID: user.ID,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusCreated, resp.Branch)
	})
}
