package list

import (
	"context"

	"github.com/google/uuid"

	"hrms/modules/company/internal/repository"
)

type Query struct {
	BranchID       *uuid.UUID // Filter by specific branch
	IncludeCentral bool       // Include central accounts (branchId = null)
	IsActive       *bool      // Filter by active status
}

type Response struct {
	Items []repository.CompanyBankAccount `json:"items"`
}

type queryHandler struct {
	repo repository.Repository
}

func NewHandler(repo repository.Repository) *queryHandler {
	return &queryHandler{repo: repo}
}

func (h *queryHandler) Handle(ctx context.Context, q *Query) (*Response, error) {
	filter := &repository.BankAccountFilter{
		BranchID:       q.BranchID,
		IncludeCentral: q.IncludeCentral,
		IsActive:       q.IsActive,
	}
	items, err := h.repo.ListBankAccounts(ctx, filter)
	if err != nil {
		return nil, err
	}
	return &Response{Items: items}, nil
}
