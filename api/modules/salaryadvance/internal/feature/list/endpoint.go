package list

import (
	"strconv"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary List salary advances
// @Description ดูรายการเบิกเงินล่วงหน้า
// @Tags Salary Advance
// @Produce json
// @Param page query int false "page"
// @Param limit query int false "limit"
// @Param employeeId query string false "employee id"
// @Param payrollMonth query string false "YYYY-MM-01"
// @Param status query string false "pending|processed"
// @Security BearerAuth
// @Success 200 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /salary-advances [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/", func(c fiber.Ctx) error {
		page, _ := strconv.Atoi(c.Query("page", "1"))
		limit, _ := strconv.Atoi(c.Query("limit", "20"))
		status := c.Query("status")

		var empID *uuid.UUID
		if v := c.Query("employeeId"); v != "" {
			id, err := uuid.Parse(v)
			if err != nil {
				return errs.BadRequest("invalid employeeId")
			}
			empID = &id
		}
		var payrollMonth *time.Time
		if v := c.Query("payrollMonth"); v != "" {
			d, err := time.Parse("2006-01-02", v)
			if err != nil {
				return errs.BadRequest("invalid payrollMonth")
			}
			payrollMonth = &d
		}

		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			Page:         page,
			Limit:        limit,
			EmployeeID:   empID,
			PayrollMonth: payrollMonth,
			Status:       status,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
