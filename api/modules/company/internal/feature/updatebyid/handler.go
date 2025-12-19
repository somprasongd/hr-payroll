package updatebyid

import (
	"context"
	"database/sql"
	"errors"

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

func (h *Handler) Handle(ctx context.Context, cmd *contracts.UpdateCompanyByIDCommand) (*contracts.UpdateCompanyByIDResponse, error) {
	company, err := h.repo.UpdateByID(ctx, cmd.ID, cmd.Code, cmd.Name, cmd.Status, cmd.ActorID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("company not found")
		}
		logger.FromContext(ctx).Error("failed to update company", zap.Error(err))
		return nil, errs.Internal("failed to update company")
	}

	return &contracts.UpdateCompanyByIDResponse{
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
