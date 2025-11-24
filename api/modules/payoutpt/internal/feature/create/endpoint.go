package create

import (
	"github.com/gofiber/fiber/v3"

	"hrms/modules/payoutpt/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
	"hrms/shared/common/storage/sqldb/transactor"
)

// @Summary Create part-time payout
// @Tags Part-Time Payout
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body Command true "payload"
// @Success 201 {object} Response
// @Router /payouts/pt [post]
func NewEndpoint(router fiber.Router, repo repository.Repository, tx transactor.Transactor) {
	router.Post("/", func(c fiber.Ctx) error {
		var req Command
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}
		req.Actor = user.ID
		req.Repo = repo
		req.Tx = tx

		resp, err := mediator.Send[*Command, *Response](c.Context(), &req)
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusCreated, resp.Payout)
	})
}
