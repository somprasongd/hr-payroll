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
	ID      uuid.UUID             `json:"-" validate:"required"`
	Status  string                `json:"status" validate:"omitempty,oneof=pending approved"`
	PayDate *string               `json:"payDate"`
	Repo    repository.Repository `json:"-"`
	Tx      transactor.Transactor `json:"-"`
	Eb      eventbus.EventBus     `json:"-"`
}

type Response struct {
	dto.Run
	Message string `json:"message,omitempty"`
}

type Handler struct{}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler() *Handler { return &Handler{} }

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	cmd.Status = strings.TrimSpace(cmd.Status)
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

	run, err := cmd.Repo.Get(ctx, tenant, cmd.ID)
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

	if cmd.Status == "approved" && user.Role != "admin" {
		return nil, errs.Forbidden("only admin can approve payroll run")
	}

	var updated *repository.Run
	if cmd.Status == "approved" {
		updated, err = cmd.Repo.Approve(ctx, tenant, cmd.ID, user.ID)
	} else {
		newStatus := run.Status
		if cmd.Status != "" {
			newStatus = cmd.Status
		}
		updated, err = cmd.Repo.UpdateStatus(ctx, tenant, cmd.ID, newStatus, payDate, user.ID)
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
			ActorID:    user.ID,
			CompanyID:  &tenant.CompanyID,
			BranchID:   tenant.BranchIDPtr(),
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
