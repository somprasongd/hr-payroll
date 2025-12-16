package delete

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

// Delete document type
// @Summary Delete employee document type
// @Description ลบประเภทเอกสารพนักงาน (soft delete)
// @Tags Employee Document Types
// @Security BearerAuth
// @Param id path string true "Document Type ID"
// @Success 204
// @Failure 401
// @Failure 404
// @Router /employee-document-types/{id} [delete]
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

		_, err = mediator.Send[*Command, mediator.NoResponse](c.Context(), &Command{
			ID:      id,
			ActorID: user.ID,
		})
		if err != nil {
			return err
		}
		return c.SendStatus(fiber.StatusNoContent)
	})
}
