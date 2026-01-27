package list

import (
	"context"
	"math"
	"time"

	"hrms/modules/payrollrun/internal/dto"
	"hrms/modules/payrollrun/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"

	"go.uber.org/zap"
)

type Query struct {
	Page   int
	Limit  int
	Status string
	Year   *int
	Month  *time.Time
}

type Response struct {
	Data []dto.Run `json:"data"`
	Meta dto.Meta  `json:"meta"`
}

type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*Query, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, q *Query) (*Response, error) {
	if q.Page < 1 {
		q.Page = 1
	}
	if q.Limit <= 0 || q.Limit > 1000 {
		q.Limit = 1000
	}

	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	res, err := h.repo.List(ctx, tenant, q.Page, q.Limit, q.Status, q.Year, q.Month)
	if err != nil {
		logger.FromContext(ctx).Error("failed to list payroll runs", zap.Error(err))
		return nil, errs.Internal("failed to list payroll runs")
	}
	var data []dto.Run
	for _, r := range res.Rows {
		data = append(data, dto.FromRun(r))
	}
	totalPages := int(math.Ceil(float64(res.Total) / float64(q.Limit)))
	if totalPages == 0 {
		totalPages = 1
	}
	return &Response{
		Data: data,
		Meta: dto.Meta{
			CurrentPage: q.Page,
			TotalPages:  totalPages,
			TotalItems:  res.Total,
		},
	}, nil
}
