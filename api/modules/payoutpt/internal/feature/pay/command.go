package pay

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"

	"hrms/modules/payoutpt/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
)

type Command struct {
	ID    uuid.UUID
	Actor uuid.UUID
	Repo  repository.Repository
	Tx    transactor.Transactor
}

type Response struct {
	Payout *repository.Payout `json:"payout"`
}

type Handler struct{}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler() *Handler { return &Handler{} }

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	var payout *repository.Payout
	if err := cmd.Tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		payout, err = cmd.Repo.MarkPaid(ctxTx, cmd.ID, cmd.Actor)
		return err
	}); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.BadRequest("payout not found or not payable")
		}
		return nil, errs.Internal("failed to mark payout paid")
	}
	return &Response{Payout: payout}, nil
}
