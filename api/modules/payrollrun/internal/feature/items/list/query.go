package itemslist

import (
	"context"
	"math"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/payrollrun/internal/dto"
	"hrms/modules/payrollrun/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
)

type ListQuery struct {
	RunID            uuid.UUID
	Page             int
	Limit            int
	Search           string
	EmployeeTypeCode string
}

type ListResponse struct {
	Data []dto.Item `json:"data"`
	Meta dto.Meta   `json:"meta"`
}

type listHandler struct {
	repo repository.Repository
}

func NewListHandler(repo repository.Repository) *listHandler {
	return &listHandler{repo: repo}
}

var _ mediator.RequestHandler[*ListQuery, *ListResponse] = (*listHandler)(nil)

func (h *listHandler) Handle(ctx context.Context, q *ListQuery) (*ListResponse, error) {
	if q.Page < 1 {
		q.Page = 1
	}
	if q.Limit <= 0 || q.Limit > 1000 {
		q.Limit = 1000
	}
	if q.EmployeeTypeCode != "" && q.EmployeeTypeCode != "full_time" && q.EmployeeTypeCode != "part_time" {
		return nil, errs.BadRequest("employeeTypeCode must be full_time or part_time")
	}

	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	res, err := h.repo.ListItems(ctx, tenant, q.RunID, q.Page, q.Limit, q.Search, q.EmployeeTypeCode)
	if err != nil {
		logger.FromContext(ctx).Error("failed to list payroll items", zap.Error(err))
		return nil, errs.Internal("failed to list payroll items")
	}
	var data []dto.Item
	for _, it := range res.Rows {
		data = append(data, dto.FromItem(it))
	}
	totalPages := int(math.Ceil(float64(res.Total) / float64(q.Limit)))
	if totalPages == 0 {
		totalPages = 1
	}
	return &ListResponse{
		Data: data,
		Meta: dto.Meta{
			CurrentPage: q.Page,
			TotalPages:  totalPages,
			TotalItems:  res.Total,
		},
	}, nil
}
