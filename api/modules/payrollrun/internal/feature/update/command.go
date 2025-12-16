package update

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
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
	ID        uuid.UUID
	Status    string  `json:"status"`
	PayDate   *string `json:"payDate"`
	ActorID   uuid.UUID
	ActorRole string
	Repo      repository.Repository
	Tx        transactor.Transactor
	Eb        eventbus.EventBus
}

type Response struct {
	dto.Run
	Message string `json:"message,omitempty"`
}

type Handler struct{}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler() *Handler { return &Handler{} }

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	if cmd.Status != "" {
		cmd.Status = strings.TrimSpace(cmd.Status)
		if cmd.Status != "pending" && cmd.Status != "approved" {
			return nil, errs.BadRequest("invalid status")
		}
	}
	if cmd.Status == "" && cmd.PayDate == nil {
		return nil, errs.BadRequest("nothing to update")
	}

	var payDate *time.Time
	if cmd.PayDate != nil {
		parsed, err := parseDate(*cmd.PayDate, "payDate")
		if err != nil {
			return nil, err
		}
		payDate = &parsed
	}

	run, err := cmd.Repo.Get(ctx, cmd.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("payroll run not found")
		}
		logger.FromContext(ctx).Error("failed to load payroll run", zap.Error(err))
		return nil, errs.Internal("failed to load payroll run")
	}
	if run.Status == "approved" {
		return nil, errs.BadRequest("approved run cannot be modified")
	}

	if cmd.Status == "approved" && cmd.ActorRole != "admin" {
		return nil, errs.Forbidden("only admin can approve payroll run")
	}

	var updated *repository.Run
	if cmd.Status == "approved" {
		updated, err = cmd.Repo.Approve(ctx, cmd.ID, cmd.ActorID)
	} else {
		newStatus := run.Status
		if cmd.Status != "" {
			newStatus = cmd.Status
		}
		updated, err = cmd.Repo.UpdateStatus(ctx, cmd.ID, newStatus, payDate, cmd.ActorID)
	}
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.BadRequest("cannot update payroll run")
		}
		logger.FromContext(ctx).Error("failed to update payroll run", zap.Error(err))
		return nil, errs.Internal("failed to update payroll run")
	}

	details := map[string]interface{}{}
	if cmd.Status != "" {
		details["status"] = cmd.Status
	}
	if payDate != nil {
		details["pay_date"] = payDate.Format("2006-01-02")
	}

	if len(details) > 0 {
		cmd.Eb.Publish(events.LogEvent{
			ActorID:    cmd.ActorID,
			Action:     "UPDATE",
			EntityName: "PAYROLL_RUN",
			EntityID:   updated.ID.String(),
			Details:    details,
			Timestamp:  time.Now(),
		})
	}

	resp := &Response{Run: dto.FromRun(*updated)}
	if cmd.Status == "approved" {
		resp.Message = "Payroll approved successfully. All related records updated."
	}
	return resp, nil
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
