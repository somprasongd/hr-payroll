package mecompanies

import (
	"context"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/user/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
)

type Query struct {
	UserID uuid.UUID
}

type Response struct {
	Companies []repository.CompanyInfo `json:"companies"`
	Branches  []repository.BranchInfo  `json:"branches"`
}

type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*Query, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, q *Query) (*Response, error) {
	companies, err := h.repo.GetUserCompanies(ctx, q.UserID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get user companies", zap.Error(err))
		return nil, errs.Internal("failed to get user companies")
	}

	branches, err := h.repo.GetUserBranches(ctx, q.UserID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get user branches", zap.Error(err))
		return nil, errs.Internal("failed to get user branches")
	}

	return &Response{
		Companies: companies,
		Branches:  branches,
	}, nil
}
