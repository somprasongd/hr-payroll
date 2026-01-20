package cyclemgmt

import (
	"context"

	"hrms/modules/bonus/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/contracts"
)

// AddHandler handles AddToBonusCycleCommand
type AddHandler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*contracts.AddToBonusCycleCommand, *contracts.AddToBonusCycleResponse] = (*AddHandler)(nil)

func NewAddHandler(repo repository.Repository) *AddHandler {
	return &AddHandler{repo: repo}
}

func (h *AddHandler) Handle(ctx context.Context, cmd *contracts.AddToBonusCycleCommand) (*contracts.AddToBonusCycleResponse, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	err := h.repo.AddEmployeeToPendingCycle(ctx, tenant, cmd.EmployeeID, cmd.ActorID)
	if err != nil {
		// Ignore "no pending cycle" errors - it's OK if there's no pending cycle
		return &contracts.AddToBonusCycleResponse{Added: false}, nil
	}

	return &contracts.AddToBonusCycleResponse{Added: true}, nil
}

// RemoveHandler handles RemoveFromBonusCycleCommand
type RemoveHandler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*contracts.RemoveFromBonusCycleCommand, *contracts.RemoveFromBonusCycleResponse] = (*RemoveHandler)(nil)

func NewRemoveHandler(repo repository.Repository) *RemoveHandler {
	return &RemoveHandler{repo: repo}
}

func (h *RemoveHandler) Handle(ctx context.Context, cmd *contracts.RemoveFromBonusCycleCommand) (*contracts.RemoveFromBonusCycleResponse, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	err := h.repo.RemoveEmployeeFromPendingCycle(ctx, tenant, cmd.EmployeeID)
	if err != nil {
		// Ignore "no pending cycle" errors - it's OK if there's no pending cycle
		return &contracts.RemoveFromBonusCycleResponse{Removed: false}, nil
	}

	return &contracts.RemoveFromBonusCycleResponse{Removed: true}, nil
}
