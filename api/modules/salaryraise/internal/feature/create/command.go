package create

import (
	"context"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/salaryraise/internal/dto"
	"hrms/modules/salaryraise/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/events"
)

type Command struct {
	PeriodStart string                `json:"periodStartDate"`
	PeriodEnd   string                `json:"periodEndDate"`
	CompanyID   uuid.UUID             `json:"-"`
	BranchID    uuid.UUID             `json:"-"`
	ActorID     uuid.UUID             `json:"-"`
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
	if cmd.ParsedPeriodStart.IsZero() || cmd.ParsedPeriodEnd.IsZero() {
		return nil, errs.BadRequest("periodStartDate and periodEndDate are required")
	}
	if cmd.ParsedPeriodEnd.Before(cmd.ParsedPeriodStart) {
		return nil, errs.BadRequest("periodEndDate must be >= periodStartDate")
	}

	var cycle *repository.Cycle
	if err := cmd.Tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		cycle, err = cmd.Repo.Create(ctxTx, cmd.ParsedPeriodStart, cmd.ParsedPeriodEnd, cmd.CompanyID, cmd.BranchID, cmd.ActorID)
		return err
	}); err != nil {
		logger.FromContext(ctx).Error("failed to create salary raise cycle", zap.Error(err))
		return nil, errs.Internal("failed to create cycle (ensure only one pending cycle exists)")
	}

	cmd.Eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		CompanyID:  &cmd.CompanyID,
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
