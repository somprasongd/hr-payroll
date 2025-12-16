package upsert

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/events"
)

type Command struct {
	EmployeeID uuid.UUID `json:"-"`
	AccumType  string    `json:"accumType"`
	AccumYear  *int      `json:"accumYear"`
	Amount     float64   `json:"amount"`
	Actor      uuid.UUID
}

type Response struct {
	repository.AccumRecord
}

type Handler struct {
	repo repository.Repository
	eb   eventbus.EventBus
}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository, eb eventbus.EventBus) *Handler {
	return &Handler{repo: repo, eb: eb}
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	cmd.AccumType = strings.TrimSpace(cmd.AccumType)
	validTypes := map[string]struct{}{
		"tax": {}, "sso": {}, "sso_employer": {}, "income": {}, "pf": {}, "pf_employer": {}, "loan_outstanding": {},
	}
	if _, ok := validTypes[cmd.AccumType]; !ok {
		return nil, errs.BadRequest("invalid accumType")
	}
	if cmd.AccumType == "tax" || cmd.AccumType == "sso" || cmd.AccumType == "sso_employer" || cmd.AccumType == "income" {
		if cmd.AccumYear == nil {
			return nil, errs.BadRequest("accumYear required for tax/sso/income")
		}
	} else {
		cmd.AccumYear = nil
	}
	if cmd.Amount < 0 {
		return nil, errs.BadRequest("amount must be non-negative")
	}

	rec := repository.AccumRecord{
		AccumType: cmd.AccumType,
		AccumYear: cmd.AccumYear,
		Amount:    cmd.Amount,
	}
	out, err := h.repo.CreateAccum(ctx, cmd.EmployeeID, rec, cmd.Actor)
	if err != nil {
		logger.FromContext(ctx).Error("failed to upsert accumulation", zap.Error(err))
		return nil, errs.Internal("failed to upsert accumulation")
	}

	details := map[string]interface{}{
		"accum_type": out.AccumType,
		"amount":     out.Amount,
	}
	if out.AccumYear != nil {
		details["accum_year"] = *out.AccumYear
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    cmd.Actor,
		Action:     "UPSERT",
		EntityName: "EMPLOYEE_ACCUM",
		EntityID:   cmd.EmployeeID.String(),
		Details:    details,
		Timestamp:  time.Now(),
	})

	return &Response{AccumRecord: *out}, nil
}
