package pay

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/payoutpt/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// Payout represents the payout response for documentation
type Payout = repository.Payout

// @Summary Mark payout paid
// @Tags Part-Time Payout
// @Security BearerAuth
// @Param id path string true "payout id"
// @Success 200 {object} Payout
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /payouts/pt/{id}/pay [post]
func NewEndpoint(router fiber.Router) {
	router.Post("/:id/pay", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid payout id")
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			ID: id,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Payout)
	})
}
