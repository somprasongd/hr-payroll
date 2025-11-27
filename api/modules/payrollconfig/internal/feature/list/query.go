package list

import (
	"context"
	"math"

	"hrms/modules/payrollconfig/internal/dto"
	"hrms/modules/payrollconfig/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"

	"go.uber.org/zap"
)

type Query struct {
	Page  int
	Limit int
}

type Response struct {
	Data []dto.Config `json:"data"`
	Meta dto.Meta     `json:"meta"`
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

	res, err := h.repo.List(ctx, q.Page, q.Limit)
	if err != nil {
		logger.FromContext(ctx).Error("failed to list payroll configs", zap.Error(err))
		return nil, errs.Internal("failed to list payroll configs")
	}

	var data []dto.Config
	for _, r := range res.Rows {
		data = append(data, dto.FromRecord(r))
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
