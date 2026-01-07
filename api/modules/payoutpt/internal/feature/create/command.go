package create

import (
	"context"
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
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/common/validator"
	"hrms/shared/events"
)

type Command struct {
	EmployeeID uuid.UUID   `json:"employeeId" validate:"required"`
	WorklogIDs []uuid.UUID `json:"worklogIds" validate:"required,min=1"`
	Repo       repository.Repository
	Tx         transactor.Transactor
	Eb         eventbus.EventBus
}

type Response struct {
	Payout *repository.Payout `json:"payout"`
}

type Handler struct{}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler() *Handler { return &Handler{} }

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	if err := validator.Validate(cmd); err != nil {
		return nil, err
	}

	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing user context")
	}

	var payout *repository.Payout
	if err := cmd.Tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		if err := cmd.Repo.ValidateWorklogs(ctxTx, tenant, cmd.EmployeeID, cmd.WorklogIDs); err != nil {
			return errs.BadRequest(err.Error())
		}
		var err error
		payout, err = cmd.Repo.Create(ctxTx, tenant, cmd.EmployeeID, cmd.WorklogIDs, user.ID)
		return err
	}); err != nil {
		var appErr *errs.AppError
		if errors.As(err, &appErr) {
			logger.FromContext(ctx).Warn("payout creation failed with app error", zap.Error(err))
			return nil, appErr
		}
		logger.FromContext(ctx).Error("failed to create payout", zap.Error(err))
		return nil, errs.Internal("failed to create payout")
	}
	cmd.Eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  &tenant.CompanyID,
		BranchID:   tenant.BranchIDPtr(),
		Action:     "CREATE",
		EntityName: "PAYOUT_PT",
		EntityID:   payout.ID.String(),
		Details: map[string]interface{}{
			"employee_id": cmd.EmployeeID.String(),
			"worklog_ids": cmd.WorklogIDs,
		},
		Timestamp: time.Now(),
	})

	return &Response{Payout: payout}, nil
}
