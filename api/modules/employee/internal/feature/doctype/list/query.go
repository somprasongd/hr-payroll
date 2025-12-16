package list

import (
	"context"

	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/mediator"
)

type Query struct{}

type Response struct {
	Items []repository.DocumentTypeRecord `json:"items"`
}

type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*Query, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, q *Query) (*Response, error) {
	items, err := h.repo.ListDocumentTypes(ctx)
	if err != nil {
		return nil, err
	}
	return &Response{Items: items}, nil
}
