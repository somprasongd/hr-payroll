package haspending

import (
	"context"

	"hrms/modules/payoutpt/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/contracts"
)

type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*contracts.HasPendingPayoutPTQuery, *contracts.HasPendingPayoutPTResponse] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, q *contracts.HasPendingPayoutPTQuery) (*contracts.HasPendingPayoutPTResponse, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	hasPending, err := h.repo.HasPendingPayout(ctx, tenant, q.EmployeeID)
	if err != nil {
		return nil, err
	}

	return &contracts.HasPendingPayoutPTResponse{HasPending: hasPending}, nil
}
