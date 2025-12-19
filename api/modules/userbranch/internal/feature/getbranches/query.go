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
	Repo   repository.Repository
	UserID uuid.UUID
}

type Response struct {
	Branches []repository.BranchAccess `json:"branches"`
}

type queryHandler struct{}

func NewHandler() *queryHandler {
	return &queryHandler{}
}

func (h *queryHandler) Handle(ctx context.Context, q *Query) (*Response, error) {
	branches, err := q.Repo.GetUserBranchAccess(ctx, q.UserID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get user branches", zap.Error(err))
		return nil, errs.Internal("failed to get user branches")
	}

	return &Response{Branches: branches}, nil
}
