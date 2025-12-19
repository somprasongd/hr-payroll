package listusers

import (
	"context"

	"go.uber.org/zap"

	"hrms/modules/userbranch/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
)


type Query struct {
	Repo repository.Repository
}

type Response struct {
	Users []repository.CompanyUser `json:"users"`
}

type queryHandler struct{}

func NewHandler() *queryHandler {
	return &queryHandler{}
}

func (h *queryHandler) Handle(ctx context.Context, q *Query) (*Response, error) {
	users, err := q.Repo.GetCompanyUsers(ctx)
	if err != nil {
		logger.FromContext(ctx).Error("failed to list company users", zap.Error(err))
		return nil, errs.Internal("failed to list users")
	}

	return &Response{Users: users}, nil
}
