package list

import (
	"context"
	"math"
	"strings"

	"hrms/modules/employee/internal/dto"
	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

type Query struct {
	Page   int
	Limit  int
	Search string
	Status string
}

type Response struct {
	Data []dto.ListItem `json:"data"`
	Meta dto.Meta       `json:"meta"`
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
	if q.Limit <= 0 || q.Limit > 100 {
		q.Limit = 20
	}
	q.Status = strings.TrimSpace(q.Status)
	if q.Status == "" {
		q.Status = "active"
	}

	res, err := h.repo.List(ctx, q.Page, q.Limit, q.Search, q.Status)
	if err != nil {
		return nil, errs.Internal("failed to list employees")
	}

	var data []dto.ListItem
	for _, r := range res.Rows {
		data = append(data, dto.FromListRecord(r))
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
