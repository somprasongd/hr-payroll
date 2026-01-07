package cancel

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/payoutpt/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/validator"
	"hrms/shared/events"
)

type Command struct {
	ID   uuid.UUID `validate:"required"`
	Repo repository.Repository
	Eb   eventbus.EventBus
}

type Handler struct{}

var _ mediator.RequestHandler[*Command, mediator.NoResponse] = (*Handler)(nil)

func NewHandler() *Handler { return &Handler{} }

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

	payout, err := cmd.Repo.Get(ctx, tenant, cmd.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("payout not found")
		}
		logger.FromContext(ctx).Error("failed to load payout", zap.Error(err))
		return mediator.NoResponse{}, errs.Internal("failed to load payout")
	}
	if payout.Status != "to_pay" {
		return mediator.NoResponse{}, errs.BadRequest("only to_pay payouts can be cancelled")
	}
	if err := cmd.Repo.SoftDelete(ctx, tenant, cmd.ID, user.ID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("payout not found or already cancelled")
		}
		logger.FromContext(ctx).Error("failed to cancel payout", zap.Error(err))
		return mediator.NoResponse{}, errs.Internal("failed to cancel payout")
	}
	cmd.Eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  &tenant.CompanyID,
		BranchID:   tenant.BranchIDPtr(),
		Action:     "DELETE",
		EntityName: "PAYOUT_PT",
		EntityID:   cmd.ID.String(),
		Details: map[string]interface{}{
			"cancelled_payout_id": cmd.ID.String(),
		},
		Timestamp: time.Now(),
	})
	return mediator.NoResponse{}, nil
}
