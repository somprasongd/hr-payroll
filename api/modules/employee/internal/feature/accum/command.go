package accum

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/google/uuid"

	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

type UpsertCommand struct {
	EmployeeID uuid.UUID `json:"-"`
	AccumType  string    `json:"accumType"`
	AccumYear  *int      `json:"accumYear"`
	Amount     float64   `json:"amount"`
	Actor      uuid.UUID
}

type UpsertResponse struct {
	Record repository.AccumRecord `json:"record"`
}

type DeleteCommand struct {
	ID uuid.UUID
}

type upsertHandler struct {
	repo repository.Repository
}
type deleteHandler struct {
	repo repository.Repository
}

func NewUpsertHandler(repo repository.Repository) *upsertHandler {
	return &upsertHandler{repo: repo}
}
func NewDeleteHandler(repo repository.Repository) *deleteHandler {
	return &deleteHandler{repo: repo}
}

var _ mediator.RequestHandler[*UpsertCommand, *UpsertResponse] = (*upsertHandler)(nil)
var _ mediator.RequestHandler[*DeleteCommand, mediator.NoResponse] = (*deleteHandler)(nil)

func (h *upsertHandler) Handle(ctx context.Context, cmd *UpsertCommand) (*UpsertResponse, error) {
	cmd.AccumType = strings.TrimSpace(cmd.AccumType)
	validTypes := map[string]struct{}{
		"tax": {}, "sso": {}, "sso_employer": {}, "pf": {}, "pf_employer": {}, "loan_outstanding": {},
	}
	if _, ok := validTypes[cmd.AccumType]; !ok {
		return nil, errs.BadRequest("invalid accumType")
	}
	if cmd.AccumType == "tax" || cmd.AccumType == "sso" || cmd.AccumType == "sso_employer" {
		if cmd.AccumYear == nil {
			return nil, errs.BadRequest("accumYear required for tax/sso")
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
		return nil, errs.Internal("failed to upsert accumulation")
	}
	return &UpsertResponse{Record: *out}, nil
}

func (h *deleteHandler) Handle(ctx context.Context, cmd *DeleteCommand) (mediator.NoResponse, error) {
	if err := h.repo.DeleteAccum(ctx, cmd.ID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("accumulation not found")
		}
		return mediator.NoResponse{}, errs.Internal("failed to delete accumulation")
	}
	return mediator.NoResponse{}, nil
}
