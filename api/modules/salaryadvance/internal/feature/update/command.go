package update

import (
	"context"
	"database/sql"
	"errors"
	"strings"
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
	Amount          float64 `json:"amount"`
	AdvanceDate     string  `json:"advanceDate"`      // expect YYYY-MM-DD
	PayrollMonthRaw string  `json:"payrollMonthDate"` // expect YYYY-MM-DD (1st of month)
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	advDate, payrollMonth, err := validate(cmd.Payload)
	if err != nil {
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

	rec := repository.Record{
		AdvanceDate:  advDate,
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

func validate(r Request) (time.Time, time.Time, error) {
	if r.Amount <= 0 {
		return time.Time{}, time.Time{}, errs.BadRequest("amount must be > 0")
	}
	advDateStr := strings.TrimSpace(r.AdvanceDate)
	if advDateStr == "" {
		return time.Time{}, time.Time{}, errs.BadRequest("advanceDate is required")
	}
	advDate, err := time.Parse("2006-01-02", advDateStr)
	if err != nil {
		return time.Time{}, time.Time{}, errs.BadRequest("advanceDate must be YYYY-MM-DD")
	}
	payrollMonthStr := strings.TrimSpace(r.PayrollMonthRaw)
	if payrollMonthStr == "" {
		return time.Time{}, time.Time{}, errs.BadRequest("payrollMonthDate is required")
	}
	payrollMonth, err := time.Parse("2006-01-02", payrollMonthStr)
	if err != nil {
		return time.Time{}, time.Time{}, errs.BadRequest("payrollMonthDate must be YYYY-MM-DD")
	}
	if payrollMonth.Day() != 1 {
		return time.Time{}, time.Time{}, errs.BadRequest("payrollMonthDate must be first day of month (YYYY-MM-01)")
	}
	return advDate, payrollMonth, nil
}
