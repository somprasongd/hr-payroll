package update

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/salaryraise/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

type RequestBody struct {
	PeriodStart *string `json:"periodStartDate"`
	PeriodEnd   *string `json:"periodEndDate"`
	Status      *string `json:"status"`
}

// @Summary Update salary raise cycle
// @Description แก้ไขช่วงเวลา หรือเปลี่ยนสถานะ (Approve/Reject)
// @Tags Salary Raise
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "cycle id"
// @Param request body RequestBody true "payload"
// @Success 200 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /salary-raise-cycles/{id} [patch]
func NewEndpoint(router fiber.Router, repo repository.Repository, eb eventbus.EventBus) {
	router.Patch("/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}
		var req RequestBody
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		start, err := parseDatePtr(req.PeriodStart)
		if err != nil {
			return err
		}
		end, err := parseDatePtr(req.PeriodEnd)
		if err != nil {
			return err
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			ID:        id,
			StartDate: start,
			EndDate:   end,
			Status:    req.Status,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
