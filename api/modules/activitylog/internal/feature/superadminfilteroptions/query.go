package superadminfilteroptions

import (
	"context"

	"go.uber.org/zap"

	"hrms/modules/activitylog/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
)

type Query struct {
	Repo *repository.Repository
}

type Response struct {
	Actions  []string `json:"actions"`
	Entities []string `json:"entities"`
}

type queryHandler struct{}

func NewHandler() *queryHandler {
	return &queryHandler{}
}

func (h *queryHandler) Handle(ctx context.Context, q *Query) (*Response, error) {
	opts, err := q.Repo.GetSystemDistinctFilters(ctx)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get system filter options", zap.Error(err))
		return nil, errs.Internal("failed to get filter options")
	}

	return &Response{
		Actions:  opts.Actions,
		Entities: opts.Entities,
	}, nil
}
