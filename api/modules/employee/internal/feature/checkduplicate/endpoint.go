package checkduplicate

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// Check duplicate employee number
// @Summary Check duplicate employee number
// @Description ตรวจสอบรหัสพนักงานซ้ำ
// @Tags Employees
// @Produce json
// @Param employeeNumber query string true "Employee number to check"
// @Param excludeId query string false "Employee ID to exclude (for edit mode)"
// @Security BearerAuth
// @Success 200 {object} Response
// @Failure 400
// @Failure 401
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /employees/check-duplicate [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/check-duplicate", func(c fiber.Ctx) error {
		employeeNumber := c.Query("employeeNumber")
		if employeeNumber == "" {
			return response.JSON(c, fiber.StatusOK, &Response{IsDuplicate: false})
		}

		var excludeID uuid.UUID
		if excludeIDStr := c.Query("excludeId"); excludeIDStr != "" {
			var err error
			excludeID, err = uuid.Parse(excludeIDStr)
			if err != nil {
				excludeID = uuid.Nil
			}
		}

		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			EmployeeNumber: employeeNumber,
			ExcludeID:      excludeID,
		})
		if err != nil {
			return err
		}

		return response.JSON(c, fiber.StatusOK, resp)
	})
}
