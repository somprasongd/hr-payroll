package create

import (
	"context"
	"time"

	"go.uber.org/zap"

	"hrms/modules/bonus/internal/dto"
	"hrms/modules/bonus/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/common/validator"
	"hrms/shared/events"
)

type Command struct {
	PayrollMonth string `json:"payrollMonthDate" validate:"required"`
	BonusYear    *int   `json:"bonusYear,omitempty"`
	PeriodStart  string `json:"periodStartDate" validate:"required"`
	PeriodEnd    string `json:"periodEndDate" validate:"required"`

	ParsedPayrollMonth time.Time `json:"-"`
	ParsedPeriodStart  time.Time `json:"-"`
	ParsedPeriodEnd    time.Time `json:"-"`
	ParsedBonusYear    int       `json:"-"`
}

type Response struct {
	dto.Cycle
}

type Handler struct {
	repo repository.Repository
	tx   transactor.Transactor
	eb   eventbus.EventBus
}

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

func NewHandler(repo repository.Repository, tx transactor.Transactor, eb eventbus.EventBus) *Handler {
	return &Handler{repo: repo, tx: tx, eb: eb}
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	if err := validator.Validate(cmd); err != nil {
		return nil, err
	}

	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing user context")
	}

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
	if err := h.tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		cycle, err = h.repo.Create(ctxTx, cmd.ParsedPayrollMonth, cmd.ParsedBonusYear, cmd.ParsedPeriodStart, cmd.ParsedPeriodEnd, tenant.CompanyID, tenant.BranchID, user.ID)
		return err
	}); err != nil {
		switch {
		case repository.IsUniqueViolation(err, "bonus_cycle_month_branch_approved_uk"):
			return nil, errs.Conflict("BONUS_CYCLE_APPROVED_EXISTS")
		case repository.IsUniqueViolation(err, "bonus_cycle_pending_branch_uk"):
			return nil, errs.Conflict("BONUS_CYCLE_PENDING_EXISTS")
		case repository.IsUniqueViolation(err, "bonus_cycle_period_tenant_uk"):
			return nil, errs.Conflict("BONUS_CYCLE_PERIOD_EXISTS")
		default:
			logger.FromContext(ctx).Error("failed to create bonus cycle", zap.Error(err))
			return nil, errs.Internal("BONUS_CYCLE_CREATE_FAILED")
		}
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  &tenant.CompanyID,
		BranchID:   tenant.BranchIDPtr(),
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
