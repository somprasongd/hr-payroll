package feature

import (
	"context"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/dashboard/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// AttendanceTopEmployeesQuery is the query for top employees by attendance
type AttendanceTopEmployeesQuery struct {
	StartDate time.Time
	EndDate   time.Time
	Limit     int
	Repo      *repository.Repository
}

// TopEmployeeDTO represents an employee in the ranking
type TopEmployeeDTO struct {
	EmployeeID     uuid.UUID `json:"employeeId"`
	EmployeeNumber string    `json:"employeeNumber"`
	FullName       string    `json:"fullName"`
	PhotoID        *string   `json:"photoId"`
	Count          int       `json:"count"`
	Total          float64   `json:"total"`
}

// AttendanceTopEmployeesResponse is the response for top employees
type AttendanceTopEmployeesResponse struct {
	Period struct {
		StartDate string `json:"startDate"`
		EndDate   string `json:"endDate"`
	} `json:"period"`
	Late        []TopEmployeeDTO `json:"late"`
	LeaveDay    []TopEmployeeDTO `json:"leaveDay"`
	LeaveDouble []TopEmployeeDTO `json:"leaveDouble"`
	LeaveHours  []TopEmployeeDTO `json:"leaveHours"`
	OT          []TopEmployeeDTO `json:"ot"`
}

type attendanceTopEmployeesHandler struct{}

func NewAttendanceTopEmployeesHandler() *attendanceTopEmployeesHandler {
	return &attendanceTopEmployeesHandler{}
}

func (h *attendanceTopEmployeesHandler) Handle(ctx context.Context, q *AttendanceTopEmployeesQuery) (*AttendanceTopEmployeesResponse, error) {
	entries, err := q.Repo.GetTopEmployeesByAttendance(ctx, q.StartDate, q.EndDate, q.Limit)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get top employees by attendance", zap.Error(err))
		return nil, errs.Internal("failed to get top employees by attendance")
	}

	resp := &AttendanceTopEmployeesResponse{
		Late:        make([]TopEmployeeDTO, 0),
		LeaveDay:    make([]TopEmployeeDTO, 0),
		LeaveDouble: make([]TopEmployeeDTO, 0),
		LeaveHours:  make([]TopEmployeeDTO, 0),
		OT:          make([]TopEmployeeDTO, 0),
	}
	resp.Period.StartDate = q.StartDate.Format("2006-01-02")
	resp.Period.EndDate = q.EndDate.Format("2006-01-02")

	for _, entry := range entries {
		dto := TopEmployeeDTO{
			EmployeeID:     entry.EmployeeID,
			EmployeeNumber: entry.EmployeeNumber,
			FullName:       entry.FullName,
			PhotoID:        entry.PhotoID,
			Count:          entry.TotalCount,
			Total:          entry.TotalQty,
		}

		switch entry.EntryType {
		case "late":
			resp.Late = append(resp.Late, dto)
		case "leave_day":
			resp.LeaveDay = append(resp.LeaveDay, dto)
		case "leave_double":
			resp.LeaveDouble = append(resp.LeaveDouble, dto)
		case "leave_hours":
			resp.LeaveHours = append(resp.LeaveHours, dto)
		case "ot":
			resp.OT = append(resp.OT, dto)
		}
	}

	return resp, nil
}

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
