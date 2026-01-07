package attendance_summary

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

// AttendanceSummaryQuery is the query for attendance summary
type AttendanceSummaryQuery struct {
	StartDate    time.Time
	EndDate      time.Time
	GroupBy      string // "month" or "day"
	DepartmentID *uuid.UUID
	EmployeeID   *uuid.UUID
	Repo         *repository.Repository
}

// AttendanceTotals contains totals for all entry types
type AttendanceTotals struct {
	LateCount        int     `json:"lateCount"`
	LateMinutes      float64 `json:"lateMinutes"`
	LeaveDayCount    int     `json:"leaveDayCount"`
	LeaveDays        float64 `json:"leaveDays"`
	LeaveHoursCount  int     `json:"leaveHoursCount"`
	LeaveHours       float64 `json:"leaveHours"`
	LeaveDoubleCount int     `json:"leaveDoubleCount"`
	LeaveDoubleDays  float64 `json:"leaveDoubleDays"`
	OtCount          int     `json:"otCount"`
	OtHours          float64 `json:"otHours"`
}

// AttendanceBreakdown contains breakdown by period
type AttendanceBreakdown struct {
	Period           string  `json:"period"`
	LateCount        int     `json:"lateCount"`
	LateMinutes      float64 `json:"lateMinutes"`
	LeaveDayCount    int     `json:"leaveDayCount"`
	LeaveDays        float64 `json:"leaveDays"`
	LeaveHoursCount  int     `json:"leaveHoursCount"`
	LeaveHours       float64 `json:"leaveHours"`
	LeaveDoubleCount int     `json:"leaveDoubleCount"`
	LeaveDoubleDays  float64 `json:"leaveDoubleDays"`
	OtCount          int     `json:"otCount"`
	OtHours          float64 `json:"otHours"`
}

// AttendanceSummaryResponse is the response for attendance summary
type AttendanceSummaryResponse struct {
	Period struct {
		StartDate string `json:"startDate"`
		EndDate   string `json:"endDate"`
	} `json:"period"`
	Totals    AttendanceTotals      `json:"totals"`
	Breakdown []AttendanceBreakdown `json:"breakdown"`
}

type attendanceSummaryHandler struct{}

func NewAttendanceSummaryHandler() *attendanceSummaryHandler {
	return &attendanceSummaryHandler{}
}

func (h *attendanceSummaryHandler) Handle(ctx context.Context, q *AttendanceSummaryQuery) (*AttendanceSummaryResponse, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	entries, err := q.Repo.GetAttendanceSummary(ctx, tenant, q.StartDate, q.EndDate, q.GroupBy, q.DepartmentID, q.EmployeeID)

	if err != nil {
		logger.FromContext(ctx).Error("failed to get attendance summary", zap.Error(err))
		return nil, errs.Internal("failed to get attendance summary")
	}

	// Aggregate by period
	periodMap := make(map[string]*AttendanceBreakdown)
	totals := AttendanceTotals{}

	for _, entry := range entries {
		if _, ok := periodMap[entry.Period]; !ok {
			periodMap[entry.Period] = &AttendanceBreakdown{Period: entry.Period}
		}
		bd := periodMap[entry.Period]

		switch entry.EntryType {
		case "late":
			bd.LateCount = entry.TotalCount
			bd.LateMinutes = entry.TotalQty
			totals.LateCount += entry.TotalCount
			totals.LateMinutes += entry.TotalQty
		case "leave_day":
			bd.LeaveDayCount = entry.TotalCount
			bd.LeaveDays = entry.TotalQty
			totals.LeaveDayCount += entry.TotalCount
			totals.LeaveDays += entry.TotalQty
		case "leave_hours":
			bd.LeaveHoursCount = entry.TotalCount
			bd.LeaveHours = entry.TotalQty
			totals.LeaveHoursCount += entry.TotalCount
			totals.LeaveHours += entry.TotalQty
		case "leave_double":
			bd.LeaveDoubleCount = entry.TotalCount
			bd.LeaveDoubleDays = entry.TotalQty
			totals.LeaveDoubleCount += entry.TotalCount
			totals.LeaveDoubleDays += entry.TotalQty
		case "ot":
			bd.OtCount = entry.TotalCount
			bd.OtHours = entry.TotalQty
			totals.OtCount += entry.TotalCount
			totals.OtHours += entry.TotalQty
		}
	}

	// Convert map to sorted slice
	breakdown := make([]AttendanceBreakdown, 0, len(periodMap))
	for _, bd := range periodMap {
		breakdown = append(breakdown, *bd)
	}
	// Sort by period
	for i := 0; i < len(breakdown); i++ {
		for j := i + 1; j < len(breakdown); j++ {
			if breakdown[i].Period > breakdown[j].Period {
				breakdown[i], breakdown[j] = breakdown[j], breakdown[i]
			}
		}
	}

	resp := &AttendanceSummaryResponse{
		Totals:    totals,
		Breakdown: breakdown,
	}
	resp.Period.StartDate = q.StartDate.Format("2006-01-02")
	resp.Period.EndDate = q.EndDate.Format("2006-01-02")

	return resp, nil
}
