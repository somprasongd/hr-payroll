package approve

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/salaryraise/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
	"hrms/shared/common/storage/sqldb/transactor"
)

type Request struct {
	Status string `json:"status"` // approved|rejected
}

// @Summary Update status salary raise cycle
// @Description อนุมัติ/ปฏิเสธรอบปรับเงินเดือน
// @Tags Salary Raise
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "cycle id"
// @Param request body Request true "status payload"
// @Success 200 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Router /salary-raise-cycles/{id}/status [post]
func NewEndpoint(router fiber.Router, repo repository.Repository, tx transactor.Transactor) {
	router.Post("/:id/status", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}
		var req Request
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			ID:     id,
			Status: req.Status,
			Actor:  user.ID,
			Repo:   repo,
			Tx:     tx,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
