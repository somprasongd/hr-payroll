package delete

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

// @Summary Delete debt transaction
// @Description ลบ transaction (เฉพาะ pending)
// @Tags Debt
// @Security BearerAuth
// @Param id path string true "transaction id"
// @Success 204 "No Content"
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Router /debt-txns/{id} [delete]
func NewEndpoint(router fiber.Router) {
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
		}); err != nil {
			return err
		}
		return c.SendStatus(fiber.StatusNoContent)
	})
}
