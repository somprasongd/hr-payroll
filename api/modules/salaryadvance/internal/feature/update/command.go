package update

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/salaryadvance/internal/dto"
	"hrms/modules/salaryadvance/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
)

type Command struct {
	ID      uuid.UUID
	Payload Request
	ActorID uuid.UUID
}

type Response struct {
	dto.Item
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

type Request struct {
	Amount      float64   `json:"amount"`
	AdvanceDate time.Time `json:"advanceDate"`
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	if err := validate(cmd.Payload); err != nil {
		return nil, err
	}

	curr, err := h.repo.Get(ctx, cmd.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("salary advance not found")
		}
		logger.FromContext(ctx).Error("failed to load salary advance", zap.Error(err))
		return nil, errs.Internal("failed to load salary advance")
	}
	if curr.Status != "pending" {
		return nil, errs.BadRequest("cannot update processed salary advance")
	}

	payrollMonth := time.Date(cmd.Payload.AdvanceDate.Year(), cmd.Payload.AdvanceDate.Month(), 1, 0, 0, 0, 0, time.UTC)
	rec := repository.Record{
		AdvanceDate:  cmd.Payload.AdvanceDate,
		PayrollMonth: payrollMonth,
		Amount:       cmd.Payload.Amount,
	}

	var updated *repository.Record
	err = h.tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		updated, err = h.repo.Update(ctxTx, cmd.ID, rec, cmd.ActorID)
		return err
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.BadRequest("cannot update processed salary advance")
		}
		logger.FromContext(ctx).Error("failed to update salary advance", zap.Error(err))
		return nil, errs.Internal("failed to update salary advance")
	}

	return &Response{Item: dto.FromRecord(*updated)}, nil
}

func validate(r Request) error {
	if r.AdvanceDate.IsZero() {
		return errs.BadRequest("advanceDate is required")
	}
	if r.Amount <= 0 {
		return errs.BadRequest("amount must be > 0")
	}
	return nil
}
