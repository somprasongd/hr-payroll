package itemsupdate

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/payrollrun/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
)

// @Summary Adjust payroll item
// @Description แก้ไขยอดในสลิป (เฉพาะรันที่ไม่ approved)
// @Tags Payroll Run
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "item id"
// @Param request body UpdateRequest true "payload"
// @Success 200 {object} UpdateResponse
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /payroll-items/{id} [patch]
func NewEndpoint(router fiber.Router, repo repository.Repository, tx transactor.Transactor, eb eventbus.EventBus) {
	router.Patch("/:itemId", func(c fiber.Ctx) error {
		itemID, err := uuid.Parse(c.Params("itemId"))
		if err != nil {
			return errs.BadRequest("invalid item id")
		}
		var req UpdateRequest
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}
		_, err = mediator.Send[*UpdateCommand, *UpdateResponse](c.Context(), &UpdateCommand{
			ID:      itemID,
			Payload: req,
		})
		if err != nil {
			return err
		}
		return c.SendStatus(fiber.StatusNoContent)
	})
}
