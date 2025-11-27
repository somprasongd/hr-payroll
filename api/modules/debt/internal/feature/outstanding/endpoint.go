package outstanding

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary Get pending debt installments for employee
// @Description คืนยอดผ่อนคงค้าง (status=pending) ของพนักงานพร้อมรายละเอียดงวด
// @Tags Debt
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param employeeId path string true "Employee ID (UUIDv7)"
// @Success 200 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Router /debt-txns/{employeeId}/outstanding-installments [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/:employeeId/outstanding-installments", func(c fiber.Ctx) error {
		_, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}
		idStr := c.Params("employeeId")
		empID, err := uuid.Parse(idStr)
		if err != nil {
			return errs.BadRequest("invalid employeeId")
		}

		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			EmployeeID: empID,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
