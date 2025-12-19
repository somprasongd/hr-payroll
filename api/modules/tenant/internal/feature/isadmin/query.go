package isadmin

import (
	"context"

	"hrms/modules/tenant/internal/repository"
	"hrms/shared/common/mediator"
	"hrms/shared/contracts"
)

// Handler handles IsAdminQuery
type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*contracts.IsAdminQuery, *contracts.IsAdminResponse] = (*Handler)(nil)

// NewHandler creates a new handler
func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

// Handle processes the query
func (h *Handler) Handle(ctx context.Context, q *contracts.IsAdminQuery) (*contracts.IsAdminResponse, error) {
	isAdmin := h.repo.IsAdmin(ctx, q.UserID, q.CompanyID)
	return &contracts.IsAdminResponse{IsAdmin: isAdmin}, nil
}
