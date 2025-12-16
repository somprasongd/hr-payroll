package list

import (
	"context"

	"github.com/google/uuid"

	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/mediator"
)

type Query struct {
	EmployeeID uuid.UUID
}

type Response struct {
	Items []repository.DocumentRecord `json:"items"`
}

type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*Query, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, q *Query) (*Response, error) {
	items, err := h.repo.ListDocuments(ctx, q.EmployeeID)
	if err != nil {
		return nil, err
	}
	return &Response{Items: items}, nil
}
