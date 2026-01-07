package list

import (
	"context"

	"go.uber.org/zap"

	"hrms/modules/branch/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
)

type Query struct{}

type Response struct {
	Branches []repository.Branch `json:"branches"`
}

type queryHandler struct {
	repo repository.Repository
}

func NewHandler(repo repository.Repository) *queryHandler {
	return &queryHandler{repo: repo}
}

func (h *queryHandler) Handle(ctx context.Context, q *Query) (*Response, error) {
	branches, err := h.repo.List(ctx)
	if err != nil {
		logger.FromContext(ctx).Error("failed to list branches", zap.Error(err))
		return nil, errs.Internal("failed to list branches")
	}

	return &Response{Branches: branches}, nil
}
