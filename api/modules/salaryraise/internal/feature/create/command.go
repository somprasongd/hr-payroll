package create

import (
	"context"
	"time"

	"go.uber.org/zap"

	"hrms/modules/salaryraise/internal/dto"
	"hrms/modules/salaryraise/internal/repository"
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
	PeriodStart string                `json:"periodStartDate" validate:"required"`
	PeriodEnd   string                `json:"periodEndDate" validate:"required"`
	Repo        repository.Repository `json:"-"`
	Tx          transactor.Transactor `json:"-"`
	Eb          eventbus.EventBus     `json:"-"`

	ParsedPeriodStart time.Time `json:"-"`
	ParsedPeriodEnd   time.Time `json:"-"`
}

type Response struct {
	dto.Cycle
}

type Handler struct{}

const dateLayout = "2006-01-02"

func (c *Command) ParseDates() error {
	start, err := time.Parse(dateLayout, c.PeriodStart)
	if err != nil {
		return errs.BadRequest("periodStartDate must be YYYY-MM-DD")
	}
	end, err := time.Parse(dateLayout, c.PeriodEnd)
	if err != nil {
		return errs.BadRequest("periodEndDate must be YYYY-MM-DD")
	}
	c.ParsedPeriodStart = start
	c.ParsedPeriodEnd = end
	return nil
}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler() *Handler { return &Handler{} }

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

	if cmd.ParsedPeriodStart.IsZero() || cmd.ParsedPeriodEnd.IsZero() {
		return nil, errs.BadRequest("periodStartDate and periodEndDate are required")
	}
	if cmd.ParsedPeriodEnd.Before(cmd.ParsedPeriodStart) {
		return nil, errs.BadRequest("periodEndDate must be >= periodStartDate")
	}

	var cycle *repository.Cycle
	if err := cmd.Tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		cycle, err = cmd.Repo.Create(ctxTx, cmd.ParsedPeriodStart, cmd.ParsedPeriodEnd, tenant.CompanyID, tenant.BranchID, user.ID)
		return err
	}); err != nil {
		if repository.IsUniqueViolation(err, "salary_raise_cycle_pending_branch_uk") {
			return nil, errs.Conflict("pending salary raise cycle for this branch already exists")
		}
		logger.FromContext(ctx).Error("failed to create salary raise cycle", zap.Error(err))
		return nil, errs.Internal("failed to create cycle")
	}

	cmd.Eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  &tenant.CompanyID,
		BranchID:   tenant.BranchIDPtr(),
		Action:     "CREATE",
		EntityName: "SALARY_RAISE_CYCLE",
		EntityID:   cycle.ID.String(),
		Details: map[string]interface{}{
			"period_start": cycle.PeriodStart.Format("2006-01-02"),
			"period_end":   cycle.PeriodEnd.Format("2006-01-02"),
		},
		Timestamp: time.Now(),
	})

	return &Response{Cycle: dto.FromCycle(*cycle)}, nil
}
