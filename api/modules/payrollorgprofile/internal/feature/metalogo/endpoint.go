package metalogo

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// Get payroll org logo metadata
// @Summary Get payroll org logo metadata
// @Tags Payroll Org Profile
// @Produce json
// @Security BearerAuth
// @Param id path string true "logo id"
// @Success 200 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Router /admin/payroll-org-logos/{id}/meta [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/:id/meta", func(c fiber.Ctx) error {
		idStr := c.Params("id")
		id, err := uuid.Parse(idStr)
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{ID: id})
		if err != nil {
			return err
		}

		return response.JSON(c, fiber.StatusOK, resp.Logo)
	})
}
