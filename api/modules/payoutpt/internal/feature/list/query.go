package list

import (
	"context"
	"math"

	"github.com/google/uuid"

	"hrms/modules/payoutpt/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

type Query struct {
	Page       int
	Limit      int
	Status     string
	EmployeeID *uuid.UUID
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
	if q.Limit <= 0 || q.Limit > 100 {
		q.Limit = 20
	}
	res, err := q.Repo.List(ctx, q.Page, q.Limit, q.EmployeeID, q.Status)
	if err != nil {
		return nil, errs.Internal("failed to list payouts")
	}
	totalPages := int(math.Ceil(float64(res.Total) / float64(q.Limit)))
	if totalPages == 0 {
		totalPages = 1
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
