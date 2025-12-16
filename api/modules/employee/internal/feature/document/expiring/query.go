package expiring

import (
	"context"

	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/mediator"
)

type Query struct {
	DaysAhead int
}

type Response struct {
	Items []repository.ExpiringDocumentRecord `json:"items"`
	Total int                                 `json:"total"`
}

type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*Query, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, q *Query) (*Response, error) {
	daysAhead := q.DaysAhead
	if daysAhead <= 0 {
		daysAhead = 30 // default 30 days
	}

	items, err := h.repo.ListExpiringDocuments(ctx, daysAhead)
	if err != nil {
		return nil, err
	}
	return &Response{Items: items, Total: len(items)}, nil
}
