package assigntobranch

import (
	"context"

	"go.uber.org/zap"

	"hrms/modules/user/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/contracts"
)

type Handler struct {
	repo repository.Repository
}

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, cmd *contracts.AssignUserToBranchCommand) (*contracts.AssignUserToBranchResponse, error) {
	if err := h.repo.AssignUserToBranch(ctx, cmd.UserID, cmd.BranchID, cmd.ActorID); err != nil {
		logger.FromContext(ctx).Error("failed to assign user to branch", zap.Error(err))
		return nil, errs.Internal("failed to assign user to branch")
	}

	return &contracts.AssignUserToBranchResponse{}, nil
}
