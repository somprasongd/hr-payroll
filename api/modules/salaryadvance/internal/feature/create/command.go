package create

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/salaryadvance/internal/dto"
	"hrms/modules/salaryadvance/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/events"
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
	eb   eventbus.EventBus
}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository, tx transactor.Transactor, eb eventbus.EventBus) *Handler {
	return &Handler{
		repo: repo,
		tx:   tx,
		eb:   eb,
	}
}

type Request struct {
	EmployeeID      uuid.UUID `json:"employeeId"`
	Amount          float64   `json:"amount"`
	AdvanceDate     string    `json:"advanceDate"`      // expect YYYY-MM-DD
	PayrollMonthRaw string    `json:"payrollMonthDate"` // expect YYYY-MM-DD (1st of month)
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	advDate, payrollMonth, err := validate(cmd.Payload)
	if err != nil {
		return nil, err
	}

	rec := repository.Record{
		EmployeeID:   cmd.Payload.EmployeeID,
		AdvanceDate:  advDate,
		PayrollMonth: payrollMonth,
		Amount:       cmd.Payload.Amount,
		Status:       "pending",
	}

	var created *repository.Record
	if err := h.tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		created, err = h.repo.Create(ctxTx, tenant, rec, cmd.ActorID)
		return err
	}); err != nil {
		logger.FromContext(ctx).Error("failed to create salary advance", zap.Error(err))
		return nil, errs.Internal("failed to create salary advance")
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		CompanyID:  &tenant.CompanyID,
		Action:     "CREATE",
		EntityName: "SALARY_ADVANCE",
		EntityID:   created.ID.String(),
		Details: map[string]interface{}{
			"amount":       created.Amount,
			"advance_date": created.AdvanceDate.Format("2006-01-02"),
		},
		Timestamp: time.Now(),
	})

	return &Response{Item: dto.FromRecord(*created)}, nil
}

func validate(r Request) (time.Time, time.Time, error) {
	if r.EmployeeID == uuid.Nil {
		return time.Time{}, time.Time{}, errs.BadRequest("employeeId is required")
	}
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
