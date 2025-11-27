package repayment

import (
	"context"
	"strings"
	"time"

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
	EmployeeID uuid.UUID `json:"employeeId"`
	TxnDateRaw string    `json:"txnDate"` // expect YYYY-MM-DD
	Amount     float64   `json:"amount"`
	Reason     *string   `json:"reason,omitempty"`
	ActorID    uuid.UUID
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

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	if cmd.EmployeeID == uuid.Nil {
		return nil, errs.BadRequest("employeeId is required")
	}
	if strings.TrimSpace(cmd.TxnDateRaw) == "" {
		return nil, errs.BadRequest("txnDate is required")
	}
	txnDate, err := time.Parse("2006-01-02", cmd.TxnDateRaw)
	if err != nil {
		return nil, errs.BadRequest("txnDate must be YYYY-MM-DD")
	}
	if cmd.Amount <= 0 {
		return nil, errs.BadRequest("amount must be > 0")
	}
	rec := repository.Record{
		EmployeeID: cmd.EmployeeID,
		TxnDate:    txnDate,
		Amount:     cmd.Amount,
		Reason:     cmd.Reason,
		TxnType:    "repayment",
		Status:     "approved",
	}

	var created *repository.Record
	if err := h.tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		created, err = h.repo.InsertRepayment(ctxTx, rec, cmd.ActorID)
		return err
	}); err != nil {
		logger.FromContext(ctx).Error("failed to create repayment", zap.Error(err))
		return nil, errs.Internal("failed to create repayment")
	}

	return &Response{Item: dto.FromRecord(*created)}, nil
}
