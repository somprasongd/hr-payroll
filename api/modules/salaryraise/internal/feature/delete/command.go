package delete

import (
	"context"
	"database/sql"

	"github.com/google/uuid"

	"hrms/modules/salaryraise/internal/repository"
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
	if err := cmd.Repo.DeleteCycle(ctx, cmd.ID, cmd.Actor); err != nil {
		if err == sql.ErrNoRows {
			return mediator.NoResponse{}, errs.NotFound("cycle not found or already deleted")
		}
		return mediator.NoResponse{}, errs.Internal("failed to delete cycle")
	}
	return mediator.NoResponse{}, nil
}
