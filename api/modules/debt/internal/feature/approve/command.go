package approve

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/debt/internal/dto"
	"hrms/modules/debt/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
)

type Command struct {
	ID    uuid.UUID
	Actor uuid.UUID
}

type Response struct {
	dto.Item
	Message string `json:"message"`
}

type Handler struct {
	repo repository.Repository
	tx   transactor.Transactor
}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository, tx transactor.Transactor) *Handler {
	return &Handler{
		repo: repo,
		tx:   tx,
	}
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	rec, err := h.repo.Get(ctx, cmd.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("debt transaction not found")
		}
		logger.FromContext(ctx).Error("failed to load debt transaction", zap.Error(err))
		return nil, errs.Internal("failed to load debt transaction")
	}
	if rec.TxnType != "loan" && rec.TxnType != "other" {
		return nil, errs.BadRequest("only loan/other can be approved")
	}
	if rec.Status != "pending" {
		return nil, errs.BadRequest("already approved")
	}

	var updated *repository.Record
	if err := h.tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		updated, err = h.repo.Approve(ctxTx, cmd.ID, cmd.Actor)
		return err
	}); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			logger.FromContext(ctx).Warn("debt transaction not found for approval", zap.Error(err))
			return nil, errs.BadRequest("cannot approve")
		}
		logger.FromContext(ctx).Error("failed to approve debt transaction", zap.Error(err))
		return nil, errs.Internal("failed to approve debt transaction")
	}

	return &Response{
		Item:    dto.FromRecord(*updated),
		Message: "Loan approved. Installments are now active.",
	}, nil
}
