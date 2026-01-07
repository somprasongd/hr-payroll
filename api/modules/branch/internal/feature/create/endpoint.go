package create

import (
	"github.com/gofiber/fiber/v3"

	"hrms/modules/branch/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// Branch represents the branch response for documentation
type Branch = repository.Branch

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
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Success 201 {object} Branch
// @Router /admin/branches [post]
func NewEndpoint(router fiber.Router) {
	router.Post("/", func(c fiber.Ctx) error {
		var req CreateRequest
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		if req.Code == "" || req.Name == "" {
			return errs.BadRequest("code and name are required")
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			Code: req.Code,
			Name: req.Name,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusCreated, resp.Branch)
	})
}
