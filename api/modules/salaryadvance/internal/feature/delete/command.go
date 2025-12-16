package delete

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/salaryadvance/internal/repository"
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
	rec, err := h.repo.Get(ctx, cmd.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("salary advance not found")
		}
		logger.FromContext(ctx).Error("failed to load salary advance", zap.Error(err))
		return mediator.NoResponse{}, errs.Internal("failed to load salary advance")
	}
	if rec.Status != "pending" {
		return mediator.NoResponse{}, errs.BadRequest("cannot delete processed salary advance")
	}
	if err := h.repo.SoftDelete(ctx, cmd.ID, cmd.Actor); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("salary advance not found")
		}
		logger.FromContext(ctx).Error("failed to delete salary advance", zap.Error(err))
		return mediator.NoResponse{}, errs.Internal("failed to delete salary advance")
	}
	h.eb.Publish(events.LogEvent{
		ActorID:    cmd.Actor,
		Action:     "DELETE",
		EntityName: "SALARY_ADVANCE",
		EntityID:   cmd.ID.String(),
		Details: map[string]interface{}{
			"deleted_advance_id": cmd.ID.String(),
		},
		Timestamp: time.Now(),
	})

	return mediator.NoResponse{}, nil
}
