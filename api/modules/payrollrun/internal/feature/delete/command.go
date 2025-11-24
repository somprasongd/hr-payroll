package delete

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"

	"hrms/modules/payrollrun/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

type Command struct {
	ID    uuid.UUID
	Actor uuid.UUID
	Repo  repository.Repository
}

type Handler struct{}

var _ mediator.RequestHandler[*Command, mediator.NoResponse] = (*Handler)(nil)

func NewHandler() *Handler { return &Handler{} }

func (h *Handler) Handle(ctx context.Context, cmd *Command) (mediator.NoResponse, error) {
	run, err := cmd.Repo.Get(ctx, cmd.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("payroll run not found")
		}
		return mediator.NoResponse{}, errs.Internal("failed to load payroll run")
	}
	if run.Status == "approved" {
		return mediator.NoResponse{}, errs.BadRequest("cannot delete approved run")
	}
	if err := cmd.Repo.SoftDelete(ctx, cmd.ID, cmd.Actor); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("payroll run not found or not deletable")
		}
		return mediator.NoResponse{}, errs.Internal("failed to delete payroll run")
	}
	return mediator.NoResponse{}, nil
}
