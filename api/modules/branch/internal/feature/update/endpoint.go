package update

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// UpdateRequest represents the request body for updating a branch
type UpdateRequest struct {
	Code   string `json:"code" validate:"required,min=1,max=10"`
	Name   string `json:"name" validate:"required,min=1,max=100"`
	Status string `json:"status" validate:"required,oneof=active suspended"`
}

// @Summary Update a branch
// @Tags Branches
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "branch ID"
// @Param request body UpdateRequest true "branch payload"
// @Success 200 {object} repository.Branch
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /admin/branches/{id} [patch]
func NewEndpoint(router fiber.Router) {
	router.Patch("/:id", func(c fiber.Ctx) error {
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		var req UpdateRequest
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		if req.Status == "" {
			req.Status = "active"
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			ID:      id,
			Code:    req.Code,
			Name:    req.Name,
			Status:  req.Status,
			ActorID: user.ID,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Branch)
	})
}
