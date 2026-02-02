package getbyid

import (
	"context"

	"github.com/google/uuid"

	"hrms/modules/company/internal/repository"
	"hrms/shared/common/errs"
)

type Query struct {
	ID uuid.UUID
}

type Response struct {
	Item *repository.CompanyBankAccount `json:"item"`
}

type queryHandler struct {
	repo repository.Repository
}

func NewHandler(repo repository.Repository) *queryHandler {
	return &queryHandler{repo: repo}
}

func (h *queryHandler) Handle(ctx context.Context, q *Query) (*Response, error) {
	item, err := h.repo.GetBankAccountByID(ctx, q.ID)
	if err != nil {
		return nil, errs.NotFound("bank account not found")
	}
	if item == nil {
		return nil, errs.NotFound("bank account not found")
	}
	return &Response{Item: item}, nil
}
