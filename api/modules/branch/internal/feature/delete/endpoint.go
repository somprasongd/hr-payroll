package delete

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/branch/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/mediator"
)

// @Summary Delete a branch (soft delete)
// @Description Soft deletes a branch. Branch must be archived before deletion.
// @Tags Branches
// @Security BearerAuth
// @Param id path string true "branch ID"
// @Success 204
// @Failure 400 {object} response.Problem "Branch must be archived before deletion"
// @Router /admin/branches/{id} [delete]
func NewEndpoint(router fiber.Router, repo repository.Repository, eb eventbus.EventBus) {
	router.Delete("/:id", func(c fiber.Ctx) error {
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		_, err = mediator.Send[*Command, mediator.NoResponse](c.Context(), &Command{
			Repo:    repo,
			Eb:      eb,
			ID:      id,
			ActorID: user.ID,
		})
		if err != nil {
			return err
		}
		return c.SendStatus(fiber.StatusNoContent)
	})
}
