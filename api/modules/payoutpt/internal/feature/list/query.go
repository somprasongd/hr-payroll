package list

import (
	"context"
	"math"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/payoutpt/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
)

type Query struct {
	Page       int
	Limit      int
	Status     string
	EmployeeID *uuid.UUID
	StartDate  *time.Time
	EndDate    *time.Time
	Repo       repository.Repository
}

type Response struct {
	Data []repository.Payout `json:"data"`
	Meta Meta                `json:"meta"`
}

type Meta struct {
	CurrentPage int `json:"currentPage"`
	TotalPages  int `json:"totalPages"`
	TotalItems  int `json:"totalItems"`
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

	res, err := q.Repo.List(ctx, tenant, q.Page, q.Limit, q.EmployeeID, q.Status, q.StartDate, q.EndDate)
	if err != nil {
		logger.FromContext(ctx).Error("failed to list payouts", zap.Error(err))
		return nil, errs.Internal("failed to list payouts")
	}
	totalPages := int(math.Ceil(float64(res.Total) / float64(q.Limit)))
	if totalPages == 0 {
		totalPages = 1
	}
	if res.Rows == nil {
		res.Rows = make([]repository.Payout, 0)
	}
	return &Response{
		Data: res.Rows,
		Meta: Meta{
			CurrentPage: q.Page,
			TotalPages:  totalPages,
			TotalItems:  res.Total,
		},
	}, nil
}
