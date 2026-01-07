package get

import (
	"context"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/branch/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
)

type Query struct {
	ID uuid.UUID
}

type Response struct {
	Branch *repository.Branch `json:"branch"`
}

type queryHandler struct {
	repo repository.Repository
}

func NewHandler(repo repository.Repository) *queryHandler {
	return &queryHandler{repo: repo}
}

func (h *queryHandler) Handle(ctx context.Context, q *Query) (*Response, error) {
	branch, err := h.repo.GetByID(ctx, q.ID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get branch", zap.Error(err))
		return nil, errs.NotFound("branch not found")
	}

	return &Response{Branch: branch}, nil
}
