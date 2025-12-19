package createdefaultbranch

import (
	"context"

	"go.uber.org/zap"

	"hrms/modules/company/internal/repository"
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

func (h *Handler) Handle(ctx context.Context, cmd *contracts.CreateDefaultBranchCommand) (*contracts.CreateDefaultBranchResponse, error) {
	branch, err := h.repo.CreateDefaultBranch(ctx, cmd.CompanyID, cmd.ActorID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to create default branch", zap.Error(err))
		return nil, errs.Internal("failed to create default branch")
	}

	return &contracts.CreateDefaultBranchResponse{
		Branch: &contracts.BranchDTO{
			ID:        branch.ID,
			CompanyID: branch.CompanyID,
			Code:      branch.Code,
			Name:      branch.Name,
			Status:    branch.Status,
			IsDefault: branch.IsDefault,
		},
	}, nil
}
