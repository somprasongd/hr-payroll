package setbranches

import (
	"context"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/userbranch/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
)


type Command struct {
	Repo      repository.Repository
	UserID    uuid.UUID
	BranchIDs []uuid.UUID
	ActorID   uuid.UUID
}

type Response struct {
	Branches []repository.BranchAccess `json:"branches"`
}

type commandHandler struct{}

func NewHandler() *commandHandler {
	return &commandHandler{}
}

func (h *commandHandler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	if err := cmd.Repo.SetUserBranches(ctx, cmd.UserID, cmd.BranchIDs, cmd.ActorID); err != nil {
		logger.FromContext(ctx).Error("failed to set user branches", zap.Error(err))
		return nil, errs.Internal("failed to set user branches")
	}

	// Return updated branches
	branches, err := cmd.Repo.GetUserBranchAccess(ctx, cmd.UserID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get user branches after update", zap.Error(err))
		return nil, errs.Internal("failed to get user branches")
	}

	return &Response{Branches: branches}, nil
}
