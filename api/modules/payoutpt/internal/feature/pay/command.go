package pay

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
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/common/validator"
	"hrms/shared/events"
)

type Command struct {
	ID uuid.UUID `validate:"required"`
}

type Response struct {
	Payout *repository.Payout `json:"payout"`
}

type Handler struct {
	repo repository.Repository
	tx   transactor.Transactor
	eb   eventbus.EventBus
}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository, tx transactor.Transactor, eb eventbus.EventBus) *Handler {
	return &Handler{repo: repo, tx: tx, eb: eb}
}

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
	if err := h.tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		payout, err = h.repo.MarkPaid(ctxTx, tenant, cmd.ID, user.ID)
		return err
	}); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			logger.FromContext(ctx).Warn("payout not payable", zap.Error(err))
			return nil, errs.BadRequest("payout not found or not payable")
		}
		logger.FromContext(ctx).Error("failed to mark payout paid", zap.Error(err))
		return nil, errs.Internal("failed to mark payout paid")
	}
	h.eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  &tenant.CompanyID,
		BranchID:   tenant.BranchIDPtr(),
		Action:     "UPDATE_STATUS",
		EntityName: "PAYOUT_PT",
		EntityID:   payout.ID.String(),
		Details: map[string]interface{}{
			"status": "paid",
		},
		Timestamp: time.Now(),
	})

	return &Response{Payout: payout}, nil
}
