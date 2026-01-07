package delete

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

// @Summary Delete accumulation
// @Tags Employees
// @Produce json
// @Security BearerAuth
// @Param accumId path string true "accumulation id"
// @Success 204 "No Content"
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /employees/accumulations/{accumId} [delete]
func NewEndpoint(router fiber.Router) {
	router.Delete("/accumulations/:accumId", func(c fiber.Ctx) error {
		accumID, err := uuid.Parse(c.Params("accumId"))
		if err != nil {
			return errs.BadRequest("invalid accumulation id")
		}
		if _, err := mediator.Send[*Command, mediator.NoResponse](c.Context(), &Command{
			ID: accumID,
		}); err != nil {
			return err
		}
		return c.SendStatus(fiber.StatusNoContent)
	})
}
