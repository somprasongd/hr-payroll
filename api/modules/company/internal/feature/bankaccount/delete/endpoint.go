package delete

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

// @Summary Delete a company bank account
// @Tags Company Bank Accounts
// @Produce json
// @Security BearerAuth
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Param id path string true "Bank Account ID"
// @Success 204 "No Content"
// @Router /admin/company/bank-accounts/{id} [delete]
func NewEndpoint(router fiber.Router) {
	router.Delete("/bank-accounts/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		_, err = mediator.Send[*Command, *Response](c.Context(), &Command{ID: id})
		if err != nil {
			return err
		}
		return c.SendStatus(fiber.StatusNoContent)
	})
}
