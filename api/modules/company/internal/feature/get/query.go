package get

import (
	"context"

	"hrms/modules/company/internal/repository"
	"hrms/shared/common/errs"
)

type Query struct{}

type Response struct {
	Company *repository.Company `json:"company"`
}

type queryHandler struct {
	repo repository.Repository
}

func NewHandler(repo repository.Repository) *queryHandler {
	return &queryHandler{repo: repo}
}

func (h *queryHandler) Handle(ctx context.Context, q *Query) (*Response, error) {
	company, err := h.repo.GetCurrent(ctx)
	if err != nil {
		return nil, errs.NotFound("company not found")
	}
	if company == nil {
		return nil, errs.BadRequest("no company context")
	}

	return &Response{Company: company}, nil
}
