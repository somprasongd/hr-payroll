package delete

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/bonus/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/mediator"
)

// @Summary Delete bonus cycle
// @Tags Bonus
// @Security BearerAuth
// @Param id path string true "cycle id"
// @Success 204
// @Router /bonus-cycles/{id} [delete]
func NewEndpoint(router fiber.Router, repo repository.Repository, eb eventbus.EventBus) {
	router.Delete("/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		if _, err := mediator.Send[*Command, mediator.NoResponse](c.Context(), &Command{
			ID:   id,
			Repo: repo,
			Eb:   eb,
		}); err != nil {
			return err
		}
		return c.SendStatus(fiber.StatusNoContent)
	})
}
