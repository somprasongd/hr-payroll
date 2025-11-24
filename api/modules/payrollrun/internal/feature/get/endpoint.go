package get

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/payrollrun/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary Get payroll run detail
// @Description ดูข้อมูลงวดเงินเดือน
// @Tags Payroll Run
// @Produce json
// @Param id path string true "run id"
// @Security BearerAuth
// @Success 200 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Router /payroll-runs/{id} [get]
func NewEndpoint(router fiber.Router, repo repository.Repository) {
	router.Get("/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}
		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			ID:   id,
			Repo: repo,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Run)
	})
}
