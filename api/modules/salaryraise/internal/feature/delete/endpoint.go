package delete

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/salaryraise/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

// @Summary Delete salary raise cycle (soft delete)
// @Tags Salary Raise
// @Security BearerAuth
// @Param id path string true "cycle id"
// @Success 204
// @Failure 400
// @Failure 401
// @Failure 404
// @Router /salary-raise-cycles/{id} [delete]
func NewEndpoint(router fiber.Router, repo repository.Repository) {
	router.Delete("/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		if _, err := mediator.Send[*Command, mediator.NoResponse](c.Context(), &Command{
			ID:    id,
			Actor: user.ID,
			Repo:  repo,
		}); err != nil {
			return err
		}
		return c.SendStatus(fiber.StatusNoContent)
	})
}
