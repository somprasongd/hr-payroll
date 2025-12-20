package create

import (
	"github.com/gofiber/fiber/v3"

	"hrms/modules/bonus/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
	"hrms/shared/common/storage/sqldb/transactor"
)

// @Summary Create bonus cycle
// @Description สร้างรอบโบนัส (pending) — มีได้ครั้งละ 1 pending ต่อสาขา และไม่อนุญาตงวดเงินเดือนที่มีรอบอนุมัติแล้วในสาขาเดียวกัน
// @Tags Bonus
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body Command true "payload"
// @Success 201 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 409 {object} response.Problem "เมื่อมี pending หรือ approved เดือนเดียวกันอยู่แล้ว"
// @Router /bonus-cycles [post]
func NewEndpoint(router fiber.Router, repo repository.Repository, tx transactor.Transactor, eb eventbus.EventBus) {
	router.Post("/", func(c fiber.Ctx) error {
		var req Command
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}
		if err := req.ParseDates(); err != nil {
			return err
		}
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}
		tenant, ok := contextx.TenantFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing tenant context")
		}
		req.CompanyID = tenant.CompanyID
		req.BranchID = tenant.BranchID
		req.ActorID = user.ID
		req.Repo = repo
		req.Tx = tx
		req.Eb = eb

		resp, err := mediator.Send[*Command, *Response](c.Context(), &req)
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusCreated, resp.Cycle)
	})
}
