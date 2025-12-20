package create

import (
	"github.com/gofiber/fiber/v3"

	"hrms/modules/payrollrun/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
	"hrms/shared/common/storage/sqldb/transactor"
)

// @Summary Create payroll run
// @Description สร้างงวดจ่ายเงินเดือน (มีได้ 1 งวดต่อสาขาต่อเดือน)
// @Tags Payroll Run
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body Command true "payload"
// @Success 201 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Router /payroll-runs [post]
func NewEndpoint(router fiber.Router, repo repository.Repository, tx transactor.Transactor, eb eventbus.EventBus) {
	router.Post("/", func(c fiber.Ctx) error {
		var req Command
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
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
		return response.JSON(c, fiber.StatusCreated, resp)
	})
}
