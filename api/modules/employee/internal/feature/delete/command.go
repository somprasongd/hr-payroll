package delete

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"

	"hrms/modules/employee/internal/repository"
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
	if err := h.repo.SoftDelete(ctx, cmd.ID, cmd.Actor); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("employee not found")
		}
		return mediator.NoResponse{}, errs.Internal("failed to delete employee")
	}
	return mediator.NoResponse{}, nil
}
