package get

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/payoutpt/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
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
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	p, err := q.Repo.Get(ctx, tenant, q.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("payout not found")
		}
		logger.FromContext(ctx).Error("failed to get payout", zap.Error(err))
		return nil, errs.Internal("failed to get payout")
	}
	items, err := q.Repo.ListItems(ctx, q.ID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to list payout items", zap.Error(err))
		return nil, errs.Internal("failed to list payout items")
	}
	return &Response{Payout: *p, Items: items}, nil
}
