package create

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"hrms/modules/payoutpt/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
)

type Command struct {
	EmployeeID uuid.UUID   `json:"employeeId"`
	WorklogIDs []uuid.UUID `json:"worklogIds"`
	Actor      uuid.UUID
	Repo       repository.Repository
	Tx         transactor.Transactor
}

type Response struct {
	Payout *repository.Payout `json:"payout"`
}

type Handler struct{}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler() *Handler { return &Handler{} }

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	if cmd.EmployeeID == uuid.Nil {
		return nil, errs.BadRequest("employeeId is required")
	}
	if len(cmd.WorklogIDs) == 0 {
		return nil, errs.BadRequest("worklogIds required")
	}

	var payout *repository.Payout
	if err := cmd.Tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		if err := cmd.Repo.ValidateWorklogs(ctxTx, cmd.EmployeeID, cmd.WorklogIDs); err != nil {
			return errs.BadRequest(err.Error())
		}
		var err error
		payout, err = cmd.Repo.Create(ctxTx, cmd.EmployeeID, cmd.WorklogIDs, cmd.Actor)
		return err
	}); err != nil {
		var appErr *errs.AppError
		if errors.As(err, &appErr) {
			return nil, err
		}
		return nil, errs.Internal("failed to create payout")
	}
	return &Response{Payout: payout}, nil
}
