package employee_summary

import (
	"context"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/dashboard/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
)

type EmployeeSummaryQuery struct{}

// EmployeeSummaryResponse is the response for employee summary
type EmployeeSummaryResponse struct {
	TotalEmployees      int                  `json:"totalEmployees"`
	ActiveEmployees     int                  `json:"activeEmployees"`
	FullTimeCount       int                  `json:"fullTimeCount"`
	PartTimeCount       int                  `json:"partTimeCount"`
	NewThisMonth        int                  `json:"newThisMonth"`
	TerminatedThisMonth int                  `json:"terminatedThisMonth"`
	ByDepartment        []DepartmentCountDTO `json:"byDepartment"`
}

// DepartmentCountDTO is the DTO for department count
type DepartmentCountDTO struct {
	DepartmentID   *uuid.UUID `json:"departmentId,omitempty"`
	DepartmentName string     `json:"departmentName"`
	Count          int        `json:"count"`
}

type employeeSummaryHandler struct {
	repo *repository.Repository
}

func NewEmployeeSummaryHandler(repo *repository.Repository) *employeeSummaryHandler {
	return &employeeSummaryHandler{repo: repo}
}

func (h *employeeSummaryHandler) Handle(ctx context.Context, q *EmployeeSummaryQuery) (*EmployeeSummaryResponse, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	summary, err := h.repo.GetEmployeeSummary(ctx, tenant)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get employee summary", zap.Error(err))
		return nil, errs.Internal("failed to get employee summary")
	}

	deptCounts, err := h.repo.GetEmployeesByDepartment(ctx, tenant)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get employees by department", zap.Error(err))
		return nil, errs.Internal("failed to get employees by department")
	}

	byDepartment := make([]DepartmentCountDTO, len(deptCounts))
	for i, dc := range deptCounts {
		byDepartment[i] = DepartmentCountDTO{
			DepartmentID:   dc.DepartmentID,
			DepartmentName: dc.DepartmentName,
			Count:          dc.Count,
		}
	}

	return &EmployeeSummaryResponse{
		TotalEmployees:      summary.TotalEmployees,
		ActiveEmployees:     summary.ActiveEmployees,
		FullTimeCount:       summary.FullTimeCount,
		PartTimeCount:       summary.PartTimeCount,
		NewThisMonth:        summary.NewThisMonth,
		TerminatedThisMonth: summary.TerminatedThisMonth,
		ByDepartment:        byDepartment,
	}, nil
}
