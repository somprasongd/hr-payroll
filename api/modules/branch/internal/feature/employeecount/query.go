package employeecount

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
	Count int `json:"count"`
}

type queryHandler struct {
	repo repository.Repository
}

func NewHandler(repo repository.Repository) *queryHandler {
	return &queryHandler{repo: repo}
}

func (h *queryHandler) Handle(ctx context.Context, q *Query) (*Response, error) {
	count, err := h.repo.GetEmployeeCountByBranch(ctx, q.ID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get employee count", zap.Error(err))
		return nil, errs.Internal("failed to get employee count")
	}

	return &Response{Count: count}, nil
}
