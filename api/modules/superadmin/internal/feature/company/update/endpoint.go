package update

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

// UpdateRequest for updating a company
type UpdateRequest struct {
	Code   string `json:"code"`
	Name   string `json:"name"`
	Status string `json:"status"`
}

// @Summary Update a company
// @Tags SuperAdmin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "company ID"
// @Param request body UpdateRequest true "company payload"
// @Success 200 {object} contracts.CompanyDTO
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /super-admin/companies/{id} [patch]
func NewEndpoint(router fiber.Router) {
	router.Patch("/companies/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid company id")
		}

		var req UpdateRequest
		if err := c.Bind().JSON(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		user, _ := contextx.UserFromContext(c.Context())

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

		return c.JSON(resp.Company)
	})
}
