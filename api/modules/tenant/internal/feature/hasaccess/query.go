package hasaccess

import (
	"context"

	"hrms/modules/tenant/internal/repository"
	"hrms/shared/common/mediator"
	"hrms/shared/contracts"
)

// Handler handles HasCompanyAccessQuery
type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*contracts.HasCompanyAccessQuery, *contracts.HasCompanyAccessResponse] = (*Handler)(nil)

// NewHandler creates a new handler
func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

// Handle processes the query
func (h *Handler) Handle(ctx context.Context, q *contracts.HasCompanyAccessQuery) (*contracts.HasCompanyAccessResponse, error) {
	hasAccess := h.repo.HasCompanyAccess(ctx, q.UserID, q.CompanyID)
	return &contracts.HasCompanyAccessResponse{HasAccess: hasAccess}, nil
}
