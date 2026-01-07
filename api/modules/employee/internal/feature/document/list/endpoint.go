package list

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// List employee documents
// @Summary List documents for employee
// @Description ดึงรายการเอกสารของพนักงาน
// @Tags Employee Documents
// @Produce json
// @Security BearerAuth
// @Param id path string true "Employee ID"
// @Success 200 {object} Response
// @Failure 401
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /employees/{id}/documents [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/", func(c fiber.Ctx) error {
		employeeID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid employee id")
		}

		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			EmployeeID: employeeID,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
