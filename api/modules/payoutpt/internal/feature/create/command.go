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
	"hrms/shared/events"
)

type Command struct {
	EmployeeID uuid.UUID   `json:"employeeId"`
	WorklogIDs []uuid.UUID `json:"worklogIds"`
	Actor      uuid.UUID
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
	if cmd.EmployeeID == uuid.Nil {
		return nil, errs.BadRequest("employeeId is required")
	}
	if len(cmd.WorklogIDs) == 0 {
		return nil, errs.BadRequest("worklogIds required")
	}

	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	var payout *repository.Payout
	if err := cmd.Tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		if err := cmd.Repo.ValidateWorklogs(ctxTx, tenant, cmd.EmployeeID, cmd.WorklogIDs); err != nil {
			return errs.BadRequest(err.Error())
		}
		var err error
		payout, err = cmd.Repo.Create(ctxTx, tenant, cmd.EmployeeID, cmd.WorklogIDs, cmd.Actor)
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
		ActorID:    cmd.Actor,
		CompanyID:  &tenant.CompanyID,
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
