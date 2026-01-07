package list

import (
	"context"
	"math"

	"hrms/modules/salaryraise/internal/dto"
	"hrms/modules/salaryraise/internal/repository"
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
	Repo   repository.Repository
}

type Response struct {
	Data []dto.Cycle `json:"data"`
	Meta dto.Meta    `json:"meta"`
}

type Handler struct{}

var _ mediator.RequestHandler[*Query, *Response] = (*Handler)(nil)

func NewHandler() *Handler { return &Handler{} }

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

	res, err := q.Repo.List(ctx, tenant, q.Page, q.Limit, q.Status, q.Year)
	if err != nil {
		logger.FromContext(ctx).Error("failed to list salary raise cycles", zap.Error(err))
		return nil, errs.Internal("failed to list salary raise cycles")
	}
	var data []dto.Cycle
	for _, c := range res.Rows {
		data = append(data, dto.FromCycle(c))
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
