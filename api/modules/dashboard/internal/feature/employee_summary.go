package feature

import (
	"context"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/dashboard/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// EmployeeSummaryQuery is the query for employee summary
type EmployeeSummaryQuery struct {
	Repo *repository.Repository
}

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

type employeeSummaryHandler struct{}

func NewEmployeeSummaryHandler() *employeeSummaryHandler {
	return &employeeSummaryHandler{}
}

func (h *employeeSummaryHandler) Handle(ctx context.Context, q *EmployeeSummaryQuery) (*EmployeeSummaryResponse, error) {
	summary, err := q.Repo.GetEmployeeSummary(ctx)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get employee summary", zap.Error(err))
		return nil, errs.Internal("failed to get employee summary")
	}

	deptCounts, err := q.Repo.GetEmployeesByDepartment(ctx)
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

// RegisterEmployeeSummary registers the employee summary endpoint
// @Summary Get employee summary
// @Description Get aggregated employee statistics
// @Tags Dashboard
// @Produce json
// @Security BearerAuth
// @Success 200 {object} EmployeeSummaryResponse
// @Failure 401
// @Failure 500
// @Router /dashboard/employee-summary [get]
func RegisterEmployeeSummary(router fiber.Router, repo *repository.Repository) {
	router.Get("/employee-summary", func(c fiber.Ctx) error {
		resp, err := mediator.Send[*EmployeeSummaryQuery, *EmployeeSummaryResponse](c.Context(), &EmployeeSummaryQuery{
			Repo: repo,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
