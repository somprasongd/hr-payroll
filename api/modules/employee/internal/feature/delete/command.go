package delete

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/contextx"
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
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return mediator.NoResponse{}, errs.Unauthorized("missing tenant context")
	}

	if err := h.repo.SoftDelete(ctx, tenant, cmd.ID, cmd.Actor); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("employee not found")
		}
		logger.FromContext(ctx).Error("failed to delete employee", zap.Error(err))
		return mediator.NoResponse{}, errs.Internal("failed to delete employee")
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    cmd.Actor,
		CompanyID:  &tenant.CompanyID,
		Action:     "DELETE",
		EntityName: "EMPLOYEE",
		EntityID:   cmd.ID.String(),
		Timestamp:  time.Now(),
	})

	return mediator.NoResponse{}, nil
}
