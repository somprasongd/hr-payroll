package create

import (
	"context"
	"time"

	"github.com/google/uuid"

	"hrms/modules/salaryraise/internal/dto"
	"hrms/modules/salaryraise/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
)

type Command struct {
	PeriodStart time.Time `json:"periodStartDate"`
	PeriodEnd   time.Time `json:"periodEndDate"`
	ActorID     uuid.UUID
	Repo        repository.Repository
	Tx          transactor.Transactor
}

type Response struct {
	dto.Cycle
}

type Handler struct{}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler() *Handler { return &Handler{} }

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	if cmd.PeriodStart.IsZero() || cmd.PeriodEnd.IsZero() {
		return nil, errs.BadRequest("periodStartDate and periodEndDate are required")
	}
	if cmd.PeriodEnd.Before(cmd.PeriodStart) {
		return nil, errs.BadRequest("periodEndDate must be >= periodStartDate")
	}

	var cycle *repository.Cycle
	if err := cmd.Tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		cycle, err = cmd.Repo.Create(ctxTx, cmd.PeriodStart, cmd.PeriodEnd, cmd.ActorID)
		return err
	}); err != nil {
		return nil, errs.Internal("failed to create cycle (ensure only one pending cycle exists)")
	}

	return &Response{Cycle: dto.FromCycle(*cycle)}, nil
}
