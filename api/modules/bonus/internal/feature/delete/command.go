package delete

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/bonus/internal/repository"
	"hrms/shared/common/contextx"

	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/events"
)

type Command struct {
	ID   uuid.UUID
	Repo repository.Repository
	Eb   eventbus.EventBus
}

type Handler struct{}

func NewHandler() *Handler { return &Handler{} }

var _ mediator.RequestHandler[*Command, mediator.NoResponse] = (*Handler)(nil)

func (h *Handler) Handle(ctx context.Context, cmd *Command) (mediator.NoResponse, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return mediator.NoResponse{}, errs.Unauthorized("missing tenant context")
	}

	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return mediator.NoResponse{}, errs.Unauthorized("missing user context")
	}

	cycle, _, err := cmd.Repo.Get(ctx, tenant, cmd.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("bonus cycle not found")
		}
		logger.FromContext(ctx).Error("failed to load bonus cycle", zap.Error(err))
		return mediator.NoResponse{}, errs.Internal("failed to load bonus cycle")
	}
	if cycle.Status == "approved" {
		return mediator.NoResponse{}, errs.BadRequest("cannot delete approved cycle")
	}
	if err := cmd.Repo.DeleteCycle(ctx, tenant, cmd.ID, user.ID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("bonus cycle not found")
		}
		logger.FromContext(ctx).Error("failed to delete bonus cycle", zap.Error(err))
		return mediator.NoResponse{}, errs.Internal("failed to delete bonus cycle")
	}
	cmd.Eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  &tenant.CompanyID,
		BranchID:   tenant.BranchIDPtr(),
		Action:     "DELETE",
		EntityName: "BONUS_CYCLE",
		EntityID:   cmd.ID.String(),
		Details: map[string]interface{}{
			"deleted_cycle_id": cmd.ID.String(),
		},
		Timestamp: time.Now(),
	})
	return mediator.NoResponse{}, nil
}
