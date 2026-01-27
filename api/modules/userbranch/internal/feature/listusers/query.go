package listusers

import (
	"context"

	"go.uber.org/zap"

	"hrms/modules/userbranch/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
)

type Query struct{}

type Response struct {
	Users []repository.CompanyUser `json:"users"`
}

type queryHandler struct {
	repo repository.Repository
}

func NewHandler(repo repository.Repository) *queryHandler {
	return &queryHandler{repo: repo}
}

func (h *queryHandler) Handle(ctx context.Context, q *Query) (*Response, error) {
	users, err := h.repo.GetCompanyUsers(ctx)
	if err != nil {
		logger.FromContext(ctx).Error("failed to list company users", zap.Error(err))
		return nil, errs.Internal("failed to list users")
	}

	// Ensure we return an empty array instead of null in JSON
	if users == nil {
		users = []repository.CompanyUser{}
	}

	return &Response{Users: users}, nil
}
