package getbranches

import (
	"context"

	"github.com/google/uuid"

	"hrms/modules/tenant/internal/repository"
	"hrms/shared/common/mediator"
	"hrms/shared/contracts"
)

// Handler handles GetUserBranchesQuery
type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*contracts.GetUserBranchesQuery, *contracts.GetUserBranchesResponse] = (*Handler)(nil)

// NewHandler creates a new handler
func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

// Handle processes the query
func (h *Handler) Handle(ctx context.Context, q *contracts.GetUserBranchesQuery) (*contracts.GetUserBranchesResponse, error) {
	branchIDs, err := h.repo.GetUserBranches(ctx, q.UserID, q.CompanyID)
	if err != nil {
		return &contracts.GetUserBranchesResponse{BranchIDs: []uuid.UUID{}}, nil
	}
	return &contracts.GetUserBranchesResponse{BranchIDs: branchIDs}, nil
}
