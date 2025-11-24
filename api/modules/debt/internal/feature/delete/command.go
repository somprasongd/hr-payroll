package delete

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"

	"hrms/modules/debt/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

type Command struct {
	ID    uuid.UUID
	Actor uuid.UUID
}

type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*Command, mediator.NoResponse] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (mediator.NoResponse, error) {
	rec, err := h.repo.Get(ctx, cmd.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("debt transaction not found")
		}
		return mediator.NoResponse{}, errs.Internal("failed to load transaction")
	}
	if rec.Status != "pending" {
		return mediator.NoResponse{}, errs.BadRequest("cannot delete non-pending transaction")
	}
	if err := h.repo.SoftDelete(ctx, cmd.ID, cmd.Actor); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("debt transaction not found")
		}
		return mediator.NoResponse{}, errs.Internal("failed to delete transaction")
	}
	return mediator.NoResponse{}, nil
}
