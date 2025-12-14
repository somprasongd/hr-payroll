package upsert

import (
	"context"
	"strings"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
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
}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
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
	return &Response{AccumRecord: *out}, nil
}
