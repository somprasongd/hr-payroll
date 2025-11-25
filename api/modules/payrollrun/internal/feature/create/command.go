package create

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"go.uber.org/zap"

	"hrms/modules/payrollrun/internal/dto"
	"hrms/modules/payrollrun/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
)

type Command struct {
	PayrollMonth    time.Time `json:"payrollMonthDate"`
	PeriodStart     time.Time `json:"periodStartDate"`
	PayDate         time.Time `json:"payDate"`
	SSORateEmp      float64   `json:"socialSecurityRateEmployee"`
	SSORateEmployer float64   `json:"socialSecurityRateEmployer"`
	ActorID         uuid.UUID
	Repo            repository.Repository
	Tx              transactor.Transactor
}

type Response struct {
	dto.Run
	Message string `json:"message"`
}

type Handler struct{}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler() *Handler { return &Handler{} }

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	if cmd.PayrollMonth.IsZero() || cmd.PayrollMonth.Day() != 1 {
		return nil, errs.BadRequest("payrollMonthDate must be first day of month")
	}
	if cmd.PeriodStart.IsZero() || cmd.PayDate.IsZero() {
		return nil, errs.BadRequest("periodStartDate and payDate are required")
	}
	if cmd.SSORateEmp < 0 || cmd.SSORateEmployer < 0 {
		return nil, errs.BadRequest("sso rates must be positive")
	}

	run := repository.Run{
		PayrollMonth:    cmd.PayrollMonth,
		PeriodStart:     cmd.PeriodStart,
		PayDate:         cmd.PayDate,
		SSORateEmp:      cmd.SSORateEmp,
		SSORateEmployer: cmd.SSORateEmployer,
	}

	var created *repository.Run
	if err := cmd.Tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		created, err = cmd.Repo.Create(ctxTx, run, cmd.ActorID)
		return err
	}); err != nil {
		logger.FromContext(ctx).Error("failed to create payroll run", zap.Error(err))
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return nil, errs.Conflict("payroll run for this month already exists")
		}
		return nil, errs.Internal("failed to create payroll run")
	}

	return &Response{
		Run:     dto.FromRun(*created),
		Message: "Payroll run created. System is generating payslips.",
	}, nil
}
