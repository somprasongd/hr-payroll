package pay

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/payoutpt/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/events"
)

type Command struct {
	ID    uuid.UUID
	Actor uuid.UUID
	Repo  repository.Repository
	Tx    transactor.Transactor
	Eb    eventbus.EventBus
}

type Response struct {
	Payout *repository.Payout `json:"payout"`
}

type Handler struct{}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler() *Handler { return &Handler{} }

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	var payout *repository.Payout
	if err := cmd.Tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		payout, err = cmd.Repo.MarkPaid(ctxTx, cmd.ID, cmd.Actor)
		return err
	}); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			logger.FromContext(ctx).Warn("payout not payable", zap.Error(err))
			return nil, errs.BadRequest("payout not found or not payable")
		}
		logger.FromContext(ctx).Error("failed to mark payout paid", zap.Error(err))
		return nil, errs.Internal("failed to mark payout paid")
	}
	cmd.Eb.Publish(events.LogEvent{
		ActorID:    cmd.Actor,
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
