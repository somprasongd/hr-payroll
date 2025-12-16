package delete

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/events"
)

type Command struct {
	ID    uuid.UUID
	Actor uuid.UUID
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
	if err := h.repo.DeleteAccum(ctx, cmd.ID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("accumulation not found")
		}
		logger.FromContext(ctx).Error("failed to delete accumulation", zap.Error(err))
		return mediator.NoResponse{}, errs.Internal("failed to delete accumulation")
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    cmd.Actor,
		Action:     "DELETE",
		EntityName: "EMPLOYEE_ACCUM",
		EntityID:   cmd.ID.String(),
		Timestamp:  time.Now(),
	})

	return mediator.NoResponse{}, nil
}
