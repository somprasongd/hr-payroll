package delete

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"

	"hrms/modules/salaryraise/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/mediator"
	"hrms/shared/common/validator"
	"hrms/shared/events"
)

type Command struct {
	ID uuid.UUID `validate:"required"`
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
	if err := validator.Validate(cmd); err != nil {
		return mediator.NoResponse{}, err
	}

	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return mediator.NoResponse{}, errs.Unauthorized("missing tenant context")
	}

	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return mediator.NoResponse{}, errs.Unauthorized("missing user context")
	}

	if err := h.repo.DeleteCycle(ctx, tenant, cmd.ID, user.ID); err != nil {
		if err == sql.ErrNoRows {
			return mediator.NoResponse{}, errs.NotFound("cycle not found or already deleted")
		}
		return mediator.NoResponse{}, errs.Internal("failed to delete cycle")
	}
	h.eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  &tenant.CompanyID,
		BranchID:   tenant.BranchIDPtr(),
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
