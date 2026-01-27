package attendance_summary

import (
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// RegisterAttendanceSummary registers the attendance summary endpoint
// @Summary Get attendance summary
// @Description Get attendance statistics with optional grouping and filtering
// @Tags Dashboard
// @Produce json
// @Param startDate query string true "Start date (YYYY-MM-DD)"
// @Param endDate query string true "End date (YYYY-MM-DD)"
// @Param groupBy query string false "Group by: month or day (default: month)"
// @Param departmentId query string false "Filter by department ID"
// @Security BearerAuth
// @Success 200 {object} AttendanceSummaryResponse
// @Failure 400
// @Failure 401
// @Failure 500
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /dashboard/attendance-summary [get]
func RegisterAttendanceSummary(router fiber.Router) {
	router.Get("/attendance-summary", func(c fiber.Ctx) error {
		startDateStr := c.Query("startDate")
		endDateStr := c.Query("endDate")

		if startDateStr == "" || endDateStr == "" {
			return errs.BadRequest("startDate and endDate are required")
		}

		startDate, err := time.Parse("2006-01-02", startDateStr)
		if err != nil {
			return errs.BadRequest("invalid startDate format, use YYYY-MM-DD")
		}

		endDate, err := time.Parse("2006-01-02", endDateStr)
		if err != nil {
			return errs.BadRequest("invalid endDate format, use YYYY-MM-DD")
		}

		groupBy := c.Query("groupBy", "month")
		if groupBy != "month" && groupBy != "day" {
			groupBy = "month"
		}

		var departmentID *uuid.UUID
		if deptStr := c.Query("departmentId"); deptStr != "" {
			id, err := uuid.Parse(deptStr)
			if err != nil {
				return errs.BadRequest("invalid departmentId")
			}
			departmentID = &id
		}

		var employeeID *uuid.UUID
		if empStr := c.Query("employeeId"); empStr != "" {
			id, err := uuid.Parse(empStr)
			if err != nil {
				return errs.BadRequest("invalid employeeId")
			}
			employeeID = &id
		}

		resp, err := mediator.Send[*AttendanceSummaryQuery, *AttendanceSummaryResponse](c.Context(), &AttendanceSummaryQuery{
			StartDate:    startDate,
			EndDate:      endDate,
			GroupBy:      groupBy,
			DepartmentID: departmentID,
			EmployeeID:   employeeID,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
