package delete

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"

	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/mediator"
	"hrms/shared/events"
)

type Command struct {
	DocumentID uuid.UUID
	ActorID    uuid.UUID
}

type Handler struct {
	repo repository.Repository
	eb   eventbus.EventBus
}

var _ mediator.RequestHandler[*Command, mediator.NoResponse] = (*Handler)(nil)

func NewHandler(repo repository.Repository, eb eventbus.EventBus) *Handler {
	return &Handler{repo: repo, eb: eb}
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (mediator.NoResponse, error) {
	err := h.repo.SoftDeleteDocument(ctx, cmd.DocumentID, cmd.ActorID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("document not found")
		}
		return mediator.NoResponse{}, err
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		Action:     "DELETE",
		EntityName: "EMPLOYEE_DOCUMENT",
		EntityID:   cmd.DocumentID.String(),
		Timestamp:  time.Now(),
	})

	return mediator.NoResponse{}, nil
}
