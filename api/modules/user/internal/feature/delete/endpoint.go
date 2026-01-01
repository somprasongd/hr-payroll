package delete

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

// Delete user (soft delete)
// @Summary Delete user (soft delete)
// @Description ลบผู้ใช้งาน (Admin)
// @Tags Admin Users
// @Produce json
// @Param id path string true "user id"
// @Security BearerAuth
// @Success 204 "No Content"
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Router /admin/users/{id} [delete]
func NewEndpoint(router fiber.Router) {
	router.Delete("/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		actor, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user context")
		}

		if _, err := mediator.Send[*Command, mediator.NoResponse](c.Context(), &Command{
			ID:    id,
			Actor: actor.ID,
		}); err != nil {
			return err
		}

		return c.SendStatus(fiber.StatusNoContent)
	})
}
