package update

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"hrms/modules/payrollrun/internal/dto"
	"hrms/modules/payrollrun/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
)

type Command struct {
	ID        uuid.UUID
	Status    string     `json:"status"`
	PayDate   *time.Time `json:"payDate"`
	ActorID   uuid.UUID
	ActorRole string
	Repo      repository.Repository
	Tx        transactor.Transactor
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
		if cmd.Status != "pending" && cmd.Status != "approved" && cmd.Status != "processing" {
			return nil, errs.BadRequest("invalid status")
		}
	}
	if cmd.Status == "" && cmd.PayDate == nil {
		return nil, errs.BadRequest("nothing to update")
	}

	run, err := cmd.Repo.Get(ctx, cmd.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("payroll run not found")
		}
		return nil, errs.Internal("failed to load payroll run")
	}
	if run.Status == "approved" {
		return nil, errs.BadRequest("approved run cannot be modified")
	}

	if cmd.Status == "approved" && cmd.ActorRole != "admin" {
		return nil, errs.Forbidden("only admin can approve payroll run")
	}
	if cmd.PayDate != nil && cmd.PayDate.IsZero() {
		return nil, errs.BadRequest("invalid payDate")
	}

	var updated *repository.Run
	if cmd.Status == "approved" {
		updated, err = cmd.Repo.Approve(ctx, cmd.ID, cmd.ActorID)
	} else {
		newStatus := run.Status
		if cmd.Status != "" {
			newStatus = cmd.Status
		}
		updated, err = cmd.Repo.UpdateStatus(ctx, cmd.ID, newStatus, cmd.PayDate, cmd.ActorID)
	}
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.BadRequest("cannot update payroll run")
		}
		return nil, errs.Internal("failed to update payroll run")
	}

	resp := &Response{Run: dto.FromRun(*updated)}
	if cmd.Status == "approved" {
		resp.Message = "Payroll approved successfully. All related records updated."
	}
	return resp, nil
}
