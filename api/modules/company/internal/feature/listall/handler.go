package listall

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

func (h *Handler) Handle(ctx context.Context, q *contracts.ListAllCompaniesQuery) (*contracts.ListAllCompaniesResponse, error) {
	companies, err := h.repo.ListAll(ctx)
	if err != nil {
		logger.FromContext(ctx).Error("failed to list all companies", zap.Error(err))
		return nil, errs.Internal("failed to list companies")
	}

	result := make([]contracts.CompanyDTO, len(companies))
	for i, c := range companies {
		result[i] = contracts.CompanyDTO{
			ID:        c.ID,
			Code:      c.Code,
			Name:      c.Name,
			Status:    c.Status,
			CreatedAt: c.CreatedAt,
			UpdatedAt: c.UpdatedAt,
		}
	}

	return &contracts.ListAllCompaniesResponse{Companies: result}, nil
}
