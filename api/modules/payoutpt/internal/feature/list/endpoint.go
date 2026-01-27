package list

import (
	"strconv"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary List part-time payouts
// @Tags Part-Time Payout
// @Produce json
// @Security BearerAuth
// @Param employeeId query string false "filter by employee"
// @Param status query string false "to_pay|paid|all"
// @Param startDate query string false "filter by start date (YYYY-MM-DD)"
// @Param endDate query string false "filter by end date (YYYY-MM-DD)"
// @Param page query int false "page"
// @Param limit query int false "limit"
// @Success 200 {object} Response
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /payouts/pt [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/", func(c fiber.Ctx) error {
		page, _ := strconv.Atoi(c.Query("page", "1"))
		limit, _ := strconv.Atoi(c.Query("limit", "20"))
		status := c.Query("status", "all")
		var empID *uuid.UUID
		if v := c.Query("employeeId"); v != "" {
			if id, err := uuid.Parse(v); err == nil {
				empID = &id
			}
		}

		// Parse date filters
		var startDate, endDate *time.Time
		if v := c.Query("startDate"); v != "" {
			if t, err := time.Parse("2006-01-02", v); err == nil {
				startDate = &t
			}
		}
		if v := c.Query("endDate"); v != "" {
			if t, err := time.Parse("2006-01-02", v); err == nil {
				// Set to end of day
				t = t.Add(24*time.Hour - time.Second)
				endDate = &t
			}
		}

		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			Page:       page,
			Limit:      limit,
			Status:     status,
			EmployeeID: empID,
			StartDate:  startDate,
			EndDate:    endDate,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
