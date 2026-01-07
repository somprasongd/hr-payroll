package delete

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/payrollrun/internal/repository"
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
	run, err := cmd.Repo.Get(ctx, tenant, cmd.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("payroll run not found")
		}
		logger.FromContext(ctx).Error("failed to load payroll run", zap.Error(err))
		return mediator.NoResponse{}, errs.Internal("failed to load payroll run")
	}
	if run.Status == "approved" {
		return mediator.NoResponse{}, errs.BadRequest("cannot delete approved run")
	}
	if err := cmd.Repo.SoftDelete(ctx, tenant, cmd.ID, user.ID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("payroll run not found or not deletable")
		}
		logger.FromContext(ctx).Error("failed to delete payroll run", zap.Error(err))
		return mediator.NoResponse{}, errs.Internal("failed to delete payroll run")
	}

	cmd.Eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  &tenant.CompanyID,
		BranchID:   tenant.BranchIDPtr(),
		Action:     "DELETE",
		EntityName: "PAYROLL_RUN",
		EntityID:   cmd.ID.String(),
		Details: map[string]interface{}{
			"deleted_run_id": cmd.ID.String(),
		},
		Timestamp: time.Now(),
	})

	return mediator.NoResponse{}, nil
}
