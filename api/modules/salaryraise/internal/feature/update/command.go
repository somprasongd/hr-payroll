package update

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/salaryraise/internal/dto"
	"hrms/modules/salaryraise/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/events"
)

const dateLayout = "2006-01-02"

type Command struct {
	ID        uuid.UUID
	StartDate *time.Time
	EndDate   *time.Time
	Status    *string
	ActorID   uuid.UUID
	ActorRole string
	Repo      repository.Repository
	Eb        eventbus.EventBus
}

type Response struct {
	dto.Cycle
}

type Handler struct{}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler() *Handler { return &Handler{} }

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	if cmd.StartDate == nil && cmd.EndDate == nil && cmd.Status == nil {
		return nil, errs.BadRequest("no fields to update")
	}

	if cmd.Status != nil {
		status := strings.TrimSpace(strings.ToLower(*cmd.Status))
		if cmd.ActorRole == "hr" {
			return nil, errs.Forbidden("HR is not allowed to change status")
		}
		if status != "approved" && status != "rejected" {
			return nil, errs.BadRequest("status must be approved or rejected")
		}
		cmd.Status = &status
	}

	if cmd.StartDate != nil && cmd.EndDate != nil && cmd.EndDate.Before(*cmd.StartDate) {
		return nil, errs.BadRequest("periodEndDate must be on or after periodStartDate")
	}

	updated, err := cmd.Repo.UpdateCycle(ctx, cmd.ID, cmd.StartDate, cmd.EndDate, cmd.Status, cmd.ActorID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("cycle not found")
		}
		msg := err.Error()
		if strings.Contains(msg, "cannot be modified") || strings.Contains(msg, "cannot change status") {
			return nil, errs.BadRequest("cycle cannot be modified in current status")
		}
		logger.FromContext(ctx).Error("failed to update salary raise cycle", zap.Error(err))
		return nil, errs.Internal("failed to update cycle")
	}

	details := map[string]interface{}{}
	if cmd.Status != nil {
		details["status"] = *cmd.Status
	}
	if cmd.StartDate != nil {
		details["start_date"] = cmd.StartDate.Format("2006-01-02")
	}
	if cmd.EndDate != nil {
		details["end_date"] = cmd.EndDate.Format("2006-01-02")
	}

	cmd.Eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		Action:     "UPDATE",
		EntityName: "SALARY_RAISE_CYCLE",
		EntityID:   updated.ID.String(),
		Details:    details,
		Timestamp:  time.Now(),
	})

	return &Response{Cycle: dto.FromCycle(*updated)}, nil
}

func parseDatePtr(in *string) (*time.Time, error) {
	if in == nil {
		return nil, nil
	}
	raw := strings.TrimSpace(*in)
	if raw == "" {
		return nil, nil
	}
	t, err := time.Parse(dateLayout, raw)
	if err != nil {
		return nil, errs.BadRequest("invalid date format, must be YYYY-MM-DD")
	}
	return &t, nil
}
