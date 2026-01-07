package delete

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

// Delete employee document
// @Summary Delete document
// @Description ลบเอกสารพนักงาน (soft delete)
// @Tags Employee Documents
// @Security BearerAuth
// @Param id path string true "Employee ID"
// @Param docId path string true "Document ID"
// @Success 204
// @Failure 401
// @Failure 404
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /employees/{id}/documents/{docId} [delete]
func NewEndpoint(router fiber.Router) {
	router.Delete("/:docId", func(c fiber.Ctx) error {
		docID, err := uuid.Parse(c.Params("docId"))
		if err != nil {
			return errs.BadRequest("invalid document id")
		}

		_, err = mediator.Send[*Command, mediator.NoResponse](c.Context(), &Command{
			DocumentID: docID,
		})
		if err != nil {
			return err
		}
		return c.SendStatus(fiber.StatusNoContent)
	})
}
