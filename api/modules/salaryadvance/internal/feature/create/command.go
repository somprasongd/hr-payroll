package create

import (
	"context"
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
	EmployeeID  uuid.UUID `json:"employeeId"`
	Amount      float64   `json:"amount"`
	AdvanceDate time.Time `json:"advanceDate"`
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	if err := validate(cmd.Payload); err != nil {
		return nil, err
	}
	payrollMonth := time.Date(cmd.Payload.AdvanceDate.Year(), cmd.Payload.AdvanceDate.Month(), 1, 0, 0, 0, 0, time.UTC)

	rec := repository.Record{
		EmployeeID:   cmd.Payload.EmployeeID,
		AdvanceDate:  cmd.Payload.AdvanceDate,
		PayrollMonth: payrollMonth,
		Amount:       cmd.Payload.Amount,
		Status:       "pending",
	}

	var created *repository.Record
	if err := h.tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		created, err = h.repo.Create(ctxTx, rec, cmd.ActorID)
		return err
	}); err != nil {
		logger.FromContext(ctx).Error("failed to create salary advance", zap.Error(err))
		return nil, errs.Internal("failed to create salary advance")
	}

	return &Response{Item: dto.FromRecord(*created)}, nil
}

func validate(r Request) error {
	if r.EmployeeID == uuid.Nil {
		return errs.BadRequest("employeeId is required")
	}
	if r.AdvanceDate.IsZero() {
		return errs.BadRequest("advanceDate is required")
	}
	if r.Amount <= 0 {
		return errs.BadRequest("amount must be > 0")
	}
	return nil
}
