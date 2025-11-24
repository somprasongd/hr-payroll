package list

import (
	"context"
	"math"

	"hrms/modules/payrollrun/internal/dto"
	"hrms/modules/payrollrun/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

type Query struct {
	Page   int
	Limit  int
	Status string
	Year   *int
	Repo   repository.Repository
}

type Response struct {
	Data []dto.Run `json:"data"`
	Meta dto.Meta  `json:"meta"`
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

	res, err := q.Repo.List(ctx, q.Page, q.Limit, q.Status, q.Year)
	if err != nil {
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
