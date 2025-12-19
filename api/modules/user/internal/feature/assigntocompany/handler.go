package assigntocompany

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

func (h *Handler) Handle(ctx context.Context, cmd *contracts.AssignUserToCompanyCommand) (*contracts.AssignUserToCompanyResponse, error) {
	if err := h.repo.AssignUserToCompany(ctx, cmd.UserID, cmd.CompanyID, cmd.Role, cmd.ActorID); err != nil {
		logger.FromContext(ctx).Error("failed to assign user to company", zap.Error(err))
		return nil, errs.Internal("failed to assign user to company")
	}

	return &contracts.AssignUserToCompanyResponse{}, nil
}
