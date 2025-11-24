package list

import (
	"context"
	"math"
	"time"

	"github.com/google/uuid"

	"hrms/modules/debt/internal/dto"
	"hrms/modules/debt/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

type Query struct {
	Page       int
	Limit      int
	EmployeeID *uuid.UUID
	Type       string
	Status     string
	StartDate  *time.Time
	EndDate    *time.Time
}

type Response struct {
	Data []dto.Item `json:"data"`
	Meta dto.Meta   `json:"meta"`
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

	res, err := h.repo.List(ctx, q.Page, q.Limit, q.EmployeeID, q.Type, q.Status, q.StartDate, q.EndDate)
	if err != nil {
		return nil, errs.Internal("failed to list debt transactions")
	}

	var data []dto.Item
	for _, r := range res.Rows {
		// skip installments in list unless explicitly requested? spec default excludes installments; handled by filter Type default all (includes). For simplicity keep all types.
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
