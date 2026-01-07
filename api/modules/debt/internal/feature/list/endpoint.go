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

// @Summary List debt transactions
// @Description ดูรายการหนี้/กู้/ผ่อน/ชำระ
// @Tags Debt
// @Produce json
// @Param page query int false "page"
// @Param limit query int false "limit"
// @Param employeeId query string false "employee id"
// @Param type query string false "loan|installment|repayment|other|all"
// @Param status query string false "pending|approved|all"
// @Param startDate query string false "YYYY-MM-DD"
// @Param endDate query string false "YYYY-MM-DD"
// @Security BearerAuth
// @Success 200 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /debt-txns [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/", func(c fiber.Ctx) error {
		page, _ := strconv.Atoi(c.Query("page", "1"))
		limit, _ := strconv.Atoi(c.Query("limit", "20"))
		typ := c.Query("type", "all")
		status := c.Query("status", "all")

		var empID *uuid.UUID
		if v := c.Query("employeeId"); v != "" {
			id, err := uuid.Parse(v)
			if err != nil {
				return errs.BadRequest("invalid employeeId")
			}
			empID = &id
		}
		var startDate, endDate *time.Time
		if v := c.Query("startDate"); v != "" {
			d, err := time.Parse("2006-01-02", v)
			if err != nil {
				return errs.BadRequest("invalid startDate")
			}
			startDate = &d
		}
		if v := c.Query("endDate"); v != "" {
			d, err := time.Parse("2006-01-02", v)
			if err != nil {
				return errs.BadRequest("invalid endDate")
			}
			endDate = &d
		}

		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			Page:       page,
			Limit:      limit,
			EmployeeID: empID,
			Type:       typ,
			Status:     status,
			StartDate:  startDate,
			EndDate:    endDate,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
