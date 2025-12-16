package itemsupdate

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/salaryraise/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
	"hrms/shared/common/storage/sqldb/transactor"
)

// @Summary Update salary raise item
// @Tags Salary Raise
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "item id"
// @Param request body Command true "payload"
// @Success 200 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Router /salary-raise-items/{id} [patch]
func NewEndpoint(router fiber.Router, repo repository.Repository, tx transactor.Transactor, eb eventbus.EventBus) {
	router.Patch("/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid item id")
		}
		var req Command
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}
		req.ID = id
		req.ActorID = user.ID
		req.Repo = repo
		req.Eb = eb

		resp, err := mediator.Send[*Command, *Response](c.Context(), &req)
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Item)
	})
}
