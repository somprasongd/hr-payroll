package create

import (
	"context"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/bonus/internal/dto"
	"hrms/modules/bonus/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/events"
)

type Command struct {
	PayrollMonth string `json:"payrollMonthDate"`
	BonusYear    *int   `json:"bonusYear,omitempty"`
	PeriodStart  string `json:"periodStartDate"`
	PeriodEnd    string `json:"periodEndDate"`
	CompanyID    uuid.UUID
	BranchID     uuid.UUID
	ActorID      uuid.UUID
	Repo         repository.Repository
	Tx           transactor.Transactor
	Eb           eventbus.EventBus

	ParsedPayrollMonth time.Time `json:"-"`
	ParsedPeriodStart  time.Time `json:"-"`
	ParsedPeriodEnd    time.Time `json:"-"`
	ParsedBonusYear    int       `json:"-"`
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
	if c.BonusYear != nil {
		if *c.BonusYear < 1 {
			return errs.BadRequest("bonusYear must be a positive year")
		}
		c.ParsedBonusYear = *c.BonusYear
	} else {
		c.ParsedBonusYear = payrollMonth.Year()
	}
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
		cycle, err = cmd.Repo.Create(ctxTx, cmd.ParsedPayrollMonth, cmd.ParsedBonusYear, cmd.ParsedPeriodStart, cmd.ParsedPeriodEnd, cmd.CompanyID, cmd.BranchID, cmd.ActorID)
		return err
	}); err != nil {
		switch {
		case repository.IsUniqueViolation(err, "bonus_cycle_month_branch_approved_uk"):
			return nil, errs.Conflict("approved bonus cycle for this branch and payroll month already exists")
		case repository.IsUniqueViolation(err, "bonus_cycle_pending_branch_uk"):
			return nil, errs.Conflict("pending bonus cycle for this branch already exists")
		default:
			logger.FromContext(ctx).Error("failed to create bonus cycle", zap.Error(err))
			return nil, errs.Internal("failed to create bonus cycle")
		}
	}

	cmd.Eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		CompanyID:  &cmd.CompanyID,
		Action:     "CREATE",
		EntityName: "BONUS_CYCLE",
		EntityID:   cycle.ID.String(),
		Details: map[string]interface{}{
			"payrollMonth": cmd.ParsedPayrollMonth,
			"bonusYear":    cmd.ParsedBonusYear,
		},
		Timestamp: time.Now(),
	})

	return &Response{Cycle: dto.FromCycle(*cycle)}, nil
}
