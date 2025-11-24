package get

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"

	"hrms/modules/payoutpt/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

type Query struct {
	ID   uuid.UUID
	Repo repository.Repository
}

type Response struct {
	Payout repository.Payout       `json:"payout"`
	Items  []repository.PayoutItem `json:"items"`
}

type Handler struct{}

var _ mediator.RequestHandler[*Query, *Response] = (*Handler)(nil)

func NewHandler() *Handler { return &Handler{} }

func (h *Handler) Handle(ctx context.Context, q *Query) (*Response, error) {
	p, err := q.Repo.Get(ctx, q.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("payout not found")
		}
		return nil, errs.Internal("failed to get payout")
	}
	items, err := q.Repo.ListItems(ctx, q.ID)
	if err != nil {
		return nil, errs.Internal("failed to list payout items")
	}
	return &Response{Payout: *p, Items: items}, nil
}
