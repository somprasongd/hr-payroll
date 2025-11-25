package create

import (
	"context"
	"time"

	"github.com/google/uuid"

	"hrms/modules/bonus/internal/dto"
	"hrms/modules/bonus/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
)

type Command struct {
	PayrollMonth string `json:"payrollMonthDate"`
	PeriodStart  string `json:"periodStartDate"`
	PeriodEnd    string `json:"periodEndDate"`
	ActorID      uuid.UUID
	Repo         repository.Repository
	Tx           transactor.Transactor

	ParsedPayrollMonth time.Time `json:"-"`
	ParsedPeriodStart  time.Time `json:"-"`
	ParsedPeriodEnd    time.Time `json:"-"`
}

type Response struct {
	dto.Cycle
}

type Handler struct{}

const dateLayout = "2006-01-02"

func (c *Command) ParseDates() error {
	payrollMonth, err := time.Parse(dateLayout, c.PayrollMonth)
	if err != nil {
		return errs.BadRequest("payrollMonthDate must be YYYY-MM-DD")
	}
	start, err := time.Parse(dateLayout, c.PeriodStart)
	if err != nil {
		return errs.BadRequest("periodStartDate must be YYYY-MM-DD")
	}
	end, err := time.Parse(dateLayout, c.PeriodEnd)
	if err != nil {
		return errs.BadRequest("periodEndDate must be YYYY-MM-DD")
	}
	c.ParsedPayrollMonth = payrollMonth
	c.ParsedPeriodStart = start
	c.ParsedPeriodEnd = end
	return nil
}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler() *Handler { return &Handler{} }

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	if cmd.ParsedPayrollMonth.IsZero() || cmd.ParsedPeriodStart.IsZero() || cmd.ParsedPeriodEnd.IsZero() {
		return nil, errs.BadRequest("payrollMonthDate, periodStartDate, periodEndDate are required")
	}
	if cmd.ParsedPayrollMonth.Day() != 1 {
		return nil, errs.BadRequest("payrollMonthDate must be first day of month")
	}
	if cmd.ParsedPeriodEnd.Before(cmd.ParsedPeriodStart) {
		return nil, errs.BadRequest("periodEndDate must be >= periodStartDate")
	}

	var cycle *repository.Cycle
	if err := cmd.Tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		cycle, err = cmd.Repo.Create(ctxTx, cmd.ParsedPayrollMonth, cmd.ParsedPeriodStart, cmd.ParsedPeriodEnd, cmd.ActorID)
		return err
	}); err != nil {
		return nil, errs.Internal("failed to create bonus cycle (only one pending allowed)")
	}

	return &Response{Cycle: dto.FromCycle(*cycle)}, nil
}
