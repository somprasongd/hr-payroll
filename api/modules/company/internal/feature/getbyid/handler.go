package getbyid

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

func (h *Handler) Handle(ctx context.Context, q *contracts.GetCompanyByIDQuery) (*contracts.GetCompanyByIDResponse, error) {
	company, err := h.repo.GetByID(ctx, q.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("company not found")
		}
		logger.FromContext(ctx).Error("failed to get company by id", zap.Error(err))
		return nil, errs.Internal("failed to get company")
	}

	return &contracts.GetCompanyByIDResponse{
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
