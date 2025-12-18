package create

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"go.uber.org/zap"

	"hrms/modules/payrollrun/internal/dto"
	"hrms/modules/payrollrun/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/events"
)

type Command struct {
	PayrollMonthRaw string                `json:"payrollMonthDate"`
	PeriodStartRaw  string                `json:"periodStartDate"`
	PayDateRaw      string                `json:"payDate"`
	SSORateEmp      float64               `json:"socialSecurityRateEmployee"`
	SSORateEmployer float64               `json:"socialSecurityRateEmployer"`
	CompanyID       uuid.UUID             `json:"-"`
	BranchID        uuid.UUID             `json:"-"`
	ActorID         uuid.UUID             `json:"-"`
	Repo            repository.Repository `json:"-"`
	Tx              transactor.Transactor `json:"-"`
	Eb              eventbus.EventBus     `json:"-"`
}

type Response struct {
	dto.Run
	Message string `json:"message"`
}

type Handler struct{}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler() *Handler { return &Handler{} }

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	payrollMonth, err := parseDate(cmd.PayrollMonthRaw, "payrollMonthDate")
	if err != nil {
		return nil, err
	}
	if payrollMonth.Day() != 1 {
		return nil, errs.BadRequest("payrollMonthDate must be first day of month (YYYY-MM-01)")
	}

	periodStart, err := parseDate(cmd.PeriodStartRaw, "periodStartDate")
	if err != nil {
		return nil, err
	}
	payDate, err := parseDate(cmd.PayDateRaw, "payDate")
	if err != nil {
		return nil, err
	}
	if cmd.SSORateEmp < 0 || cmd.SSORateEmployer < 0 {
		return nil, errs.BadRequest("sso rates must be positive")
	}

	run := repository.Run{
		PayrollMonth:    payrollMonth,
		PeriodStart:     periodStart,
		PayDate:         payDate,
		SSORateEmp:      cmd.SSORateEmp,
		SSORateEmployer: cmd.SSORateEmployer,
	}

	var created *repository.Run
	if err := cmd.Tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		created, err = cmd.Repo.Create(ctxTx, run, cmd.CompanyID, cmd.BranchID, cmd.ActorID)
		return err
	}); err != nil {
		logger.FromContext(ctx).Error("failed to create payroll run", zap.Error(err))
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return nil, errs.Conflict("payroll run for this month already exists")
		}
		return nil, errs.Internal("failed to create payroll run")
	}

	cmd.Eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		Action:     "CREATE",
		EntityName: "PAYROLL_RUN",
		EntityID:   created.ID.String(),
		Details: map[string]interface{}{
			"payroll_month": created.PayrollMonth.Format("2006-01-02"),
		},
		Timestamp: time.Now(),
	})

	return &Response{
		Run:     dto.FromRun(*created),
		Message: "Payroll run created. System is generating payslips.",
	}, nil
}

func parseDate(raw, field string) (time.Time, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return time.Time{}, errs.BadRequest(field + " is required")
	}

	layouts := []string{
		time.RFC3339,
		"2006-01-02",
	}
	for _, layout := range layouts {
		var t time.Time
		var err error
		if layout == "2006-01-02" {
			t, err = time.ParseInLocation(layout, value, time.UTC)
		} else {
			t, err = time.Parse(layout, value)
		}
		if err == nil {
			return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC), nil
		}
	}

	return time.Time{}, errs.BadRequest(field + " must be a valid date (YYYY-MM-DD)")
}
