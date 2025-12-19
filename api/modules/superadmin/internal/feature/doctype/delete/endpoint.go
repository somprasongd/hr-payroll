package delete

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/contracts"
)

// @Summary Delete a system document type
// @Tags SuperAdmin
// @Security BearerAuth
// @Param id path string true "document type ID"
// @Success 204
// @Router /super-admin/employee-document-types/{id} [delete]
func NewEndpoint(router fiber.Router) {
	router.Delete("/employee-document-types/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid document type id")
		}

		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		_, err = mediator.Send[*contracts.DeleteSystemDocTypeCommand, mediator.NoResponse](c.Context(), &contracts.DeleteSystemDocTypeCommand{
			ID:      id,
			ActorID: user.ID,
		})
		if err != nil {
			return err
		}

		return c.SendStatus(fiber.StatusNoContent)
	})
}
