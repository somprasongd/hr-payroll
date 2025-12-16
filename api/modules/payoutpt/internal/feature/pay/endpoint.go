package pay

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/payoutpt/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
	"hrms/shared/common/storage/sqldb/transactor"
)

// @Summary Mark payout paid
// @Tags Part-Time Payout
// @Security BearerAuth
// @Param id path string true "payout id"
// @Success 200 {object} repository.Payout
// @Router /payouts/pt/{id}/pay [post]
func NewEndpoint(router fiber.Router, repo repository.Repository, tx transactor.Transactor, eb eventbus.EventBus) {
	router.Post("/:id/pay", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid payout id")
		}
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}
		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			ID:    id,
			Actor: user.ID,
			Repo:  repo,
			Tx:    tx,
			Eb:    eb,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Payout)
	})
}
