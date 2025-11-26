package itemslist

import (
	"context"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/salaryraise/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
)

type Query struct {
	CycleID uuid.UUID
	Search  string
	Repo    repository.Repository
}

type Response struct {
	Data []repository.Item `json:"data"`
}

type Handler struct{}

var _ mediator.RequestHandler[*Query, *Response] = (*Handler)(nil)

func NewHandler() *Handler { return &Handler{} }

func (h *Handler) Handle(ctx context.Context, q *Query) (*Response, error) {
	items, err := q.Repo.ListItems(ctx, q.CycleID, q.Search)
	if err != nil {
		logger.FromContext(ctx).Error("failed to list salary raise items", zap.Error(err))
		return nil, errs.Internal("failed to list salary raise items")
	}
	return &Response{Data: items}, nil
}
