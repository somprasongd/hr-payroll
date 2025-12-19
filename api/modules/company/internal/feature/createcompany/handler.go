package createcompany

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

func (h *Handler) Handle(ctx context.Context, cmd *contracts.CreateCompanyCommand) (*contracts.CreateCompanyResponse, error) {
	company, err := h.repo.Create(ctx, cmd.Code, cmd.Name, cmd.ActorID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to create company", zap.Error(err))
		return nil, errs.Internal("failed to create company")
	}

	return &contracts.CreateCompanyResponse{
		Company: &contracts.CompanyDTO{
			ID:        company.ID,
			Code:      company.Code,
			Name:      company.Name,
			Status:    company.Status,
			CreatedAt: company.CreatedAt,
			UpdatedAt: company.UpdatedAt,
		},
	}, nil
}
