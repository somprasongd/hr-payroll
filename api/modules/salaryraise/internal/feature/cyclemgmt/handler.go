package cyclemgmt

import (
	"context"

	"hrms/modules/salaryraise/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/contracts"
)

// AddHandler handles AddToSalaryRaiseCycleCommand
type AddHandler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*contracts.AddToSalaryRaiseCycleCommand, *contracts.AddToSalaryRaiseCycleResponse] = (*AddHandler)(nil)

func NewAddHandler(repo repository.Repository) *AddHandler {
	return &AddHandler{repo: repo}
}

func (h *AddHandler) Handle(ctx context.Context, cmd *contracts.AddToSalaryRaiseCycleCommand) (*contracts.AddToSalaryRaiseCycleResponse, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	err := h.repo.AddEmployeeToPendingCycle(ctx, tenant, cmd.EmployeeID, cmd.ActorID)
	if err != nil {
		// Ignore "no pending cycle" errors - it's OK if there's no pending cycle
		return &contracts.AddToSalaryRaiseCycleResponse{Added: false}, nil
	}

	return &contracts.AddToSalaryRaiseCycleResponse{Added: true}, nil
}

// RemoveHandler handles RemoveFromSalaryRaiseCycleCommand
type RemoveHandler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*contracts.RemoveFromSalaryRaiseCycleCommand, *contracts.RemoveFromSalaryRaiseCycleResponse] = (*RemoveHandler)(nil)

func NewRemoveHandler(repo repository.Repository) *RemoveHandler {
	return &RemoveHandler{repo: repo}
}

func (h *RemoveHandler) Handle(ctx context.Context, cmd *contracts.RemoveFromSalaryRaiseCycleCommand) (*contracts.RemoveFromSalaryRaiseCycleResponse, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	err := h.repo.RemoveEmployeeFromPendingCycle(ctx, tenant, cmd.EmployeeID)
	if err != nil {
		// Ignore "no pending cycle" errors - it's OK if there's no pending cycle
		return &contracts.RemoveFromSalaryRaiseCycleResponse{Removed: false}, nil
	}

	return &contracts.RemoveFromSalaryRaiseCycleResponse{Removed: true}, nil
}
