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
	Repo repository.Repository
	ID   uuid.UUID
}

type Response struct {
	Branch *repository.Branch `json:"branch"`
}

type queryHandler struct{}

func NewHandler() *queryHandler {
	return &queryHandler{}
}

func (h *queryHandler) Handle(ctx context.Context, q *Query) (*Response, error) {
	branch, err := q.Repo.GetByID(ctx, q.ID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get branch", zap.Error(err))
		return nil, errs.NotFound("branch not found")
	}

	return &Response{Branch: branch}, nil
}
