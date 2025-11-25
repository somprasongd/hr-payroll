package accum

import (
	"context"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/logger"
)

type ListQuery struct {
	EmployeeID uuid.UUID
}

type ListResponse struct {
	Data []repository.AccumRecord `json:"data"`
}

type listHandler struct {
	repo repository.Repository
}

func NewListHandler(repo repository.Repository) *listHandler {
	return &listHandler{repo: repo}
}

func (h *listHandler) Handle(ctx context.Context, q *ListQuery) (*ListResponse, error) {
	data, err := h.repo.ListAccum(ctx, q.EmployeeID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to list accumulations", zap.Error(err))
		return nil, err
	}
	return &ListResponse{Data: data}, nil
}
