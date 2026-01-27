package getbranches

import (
	"context"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/userbranch/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
)

type Query struct {
	UserID uuid.UUID
}

type Response struct {
	Branches []repository.BranchAccess `json:"branches"`
}

type queryHandler struct {
	repo repository.Repository
}

func NewHandler(repo repository.Repository) *queryHandler {
	return &queryHandler{repo: repo}
}

func (h *queryHandler) Handle(ctx context.Context, q *Query) (*Response, error) {
	branches, err := h.repo.GetUserBranchAccess(ctx, q.UserID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get user branches", zap.Error(err))
		return nil, errs.Internal("failed to get user branches")
	}

	// Ensure we return an empty array instead of null in JSON
	if branches == nil {
		branches = []repository.BranchAccess{}
	}

	return &Response{Branches: branches}, nil
}
