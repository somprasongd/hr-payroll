package attendance_top_employees

import (
	"strconv"
	"time"

	"github.com/gofiber/fiber/v3"

	"hrms/modules/dashboard/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// RegisterAttendanceTopEmployees registers the attendance top employees endpoint
// @Summary Get top employees by attendance
// @Description Get top employees ranked by attendance entry type
// @Tags Dashboard
// @Produce json
// @Param periodType query string true "Period type: month or year"
// @Param year query int true "Year (e.g., 2026)"
// @Param month query int false "Month (1-12), required if periodType=month"
// @Param limit query int false "Number of top employees per category (default: 10)"
// @Security BearerAuth
// @Success 200 {object} AttendanceTopEmployeesResponse
// @Failure 400
// @Failure 401
// @Failure 500
// @Router /dashboard/attendance-top-employees [get]
func RegisterAttendanceTopEmployees(router fiber.Router, repo *repository.Repository) {
	router.Get("/attendance-top-employees", func(c fiber.Ctx) error {
		periodType := c.Query("periodType", "month")
		yearStr := c.Query("year")
		monthStr := c.Query("month")
		limitStr := c.Query("limit", "10")

		if yearStr == "" {
			return errs.BadRequest("year is required")
		}

		year, err := strconv.Atoi(yearStr)
		if err != nil {
			return errs.BadRequest("invalid year")
		}

		limit, err := strconv.Atoi(limitStr)
		if err != nil {
			limit = 10
		}

		var startDate, endDate time.Time

		if periodType == "month" {
			if monthStr == "" {
				return errs.BadRequest("month is required for periodType=month")
			}
			month, err := strconv.Atoi(monthStr)
			if err != nil || month < 1 || month > 12 {
				return errs.BadRequest("invalid month, must be 1-12")
			}
			startDate = time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
			endDate = startDate.AddDate(0, 1, -1) // Last day of month
		} else {
			// Yearly
			startDate = time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate = time.Date(year, 12, 31, 0, 0, 0, 0, time.UTC)
		}

		resp, err := mediator.Send[*AttendanceTopEmployeesQuery, *AttendanceTopEmployeesResponse](c.Context(), &AttendanceTopEmployeesQuery{
			StartDate: startDate,
			EndDate:   endDate,
			Limit:     limit,
			Repo:      repo,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
