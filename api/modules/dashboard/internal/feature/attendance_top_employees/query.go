package attendance_top_employees

import (
	"context"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/dashboard/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
)

// AttendanceTopEmployeesQuery is the query for top employees by attendance
type AttendanceTopEmployeesQuery struct {
	StartDate time.Time
	EndDate   time.Time
	Limit     int
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
	LateCount   []TopEmployeeDTO `json:"lateCount"`
	LeaveDay    []TopEmployeeDTO `json:"leaveDay"`
	LeaveDouble []TopEmployeeDTO `json:"leaveDouble"`
	LeaveHours  []TopEmployeeDTO `json:"leaveHours"`
	OT          []TopEmployeeDTO `json:"ot"`
}

type attendanceTopEmployeesHandler struct {
	repo *repository.Repository
}

func NewAttendanceTopEmployeesHandler(repo *repository.Repository) *attendanceTopEmployeesHandler {
	return &attendanceTopEmployeesHandler{repo: repo}
}

func (h *attendanceTopEmployeesHandler) Handle(ctx context.Context, q *AttendanceTopEmployeesQuery) (*AttendanceTopEmployeesResponse, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	entries, err := h.repo.GetTopEmployeesByAttendance(ctx, tenant, q.StartDate, q.EndDate, q.Limit)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get top employees by attendance", zap.Error(err))
		return nil, errs.Internal("failed to get top employees by attendance")
	}

	resp := &AttendanceTopEmployeesResponse{
		Late:        make([]TopEmployeeDTO, 0),
		LateCount:   make([]TopEmployeeDTO, 0),
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
		case "late_count":
			resp.LateCount = append(resp.LateCount, dto)
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
