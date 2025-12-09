package cancel

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/payoutpt/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
)

type Command struct {
	ID    uuid.UUID
	Actor uuid.UUID
	Repo  repository.Repository
}

type Handler struct{}

var _ mediator.RequestHandler[*Command, mediator.NoResponse] = (*Handler)(nil)

func NewHandler() *Handler { return &Handler{} }

func (h *Handler) Handle(ctx context.Context, cmd *Command) (mediator.NoResponse, error) {
	payout, err := cmd.Repo.Get(ctx, cmd.ID)
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
	if err := cmd.Repo.SoftDelete(ctx, cmd.ID, cmd.Actor); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("payout not found or already cancelled")
		}
		logger.FromContext(ctx).Error("failed to cancel payout", zap.Error(err))
		return mediator.NoResponse{}, errs.Internal("failed to cancel payout")
	}
	return mediator.NoResponse{}, nil
}
