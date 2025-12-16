package delete

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"

	"hrms/modules/salaryraise/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/mediator"
	"hrms/shared/events"
)

type Command struct {
	ID    uuid.UUID
	Actor uuid.UUID
	Repo  repository.Repository
	Eb    eventbus.EventBus
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
	cmd.Eb.Publish(events.LogEvent{
		ActorID:    cmd.Actor,
		Action:     "DELETE",
		EntityName: "SALARY_RAISE_CYCLE",
		EntityID:   cmd.ID.String(),
		Details: map[string]interface{}{
			"deleted_cycle_id": cmd.ID.String(),
		},
		Timestamp: time.Now(),
	})

	return mediator.NoResponse{}, nil
}
