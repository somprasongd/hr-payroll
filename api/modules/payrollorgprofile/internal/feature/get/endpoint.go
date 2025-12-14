package get

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// Get payroll org profile
// @Summary Get payroll org profile by ID
// @Tags Payroll Org Profile
// @Produce json
// @Security BearerAuth
// @Param id path string true "profile id"
// @Success 200 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Router /admin/payroll-org-profiles/{id} [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/:id", func(c fiber.Ctx) error {
		idStr := c.Params("id")
		id, err := uuid.Parse(idStr)
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{ID: id})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Profile)
	})
}
