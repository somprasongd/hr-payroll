package itemslist

import (
	"context"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/salaryraise/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
)

type Query struct {
	CycleID uuid.UUID
	Search  string
}

type Response struct {
	Data []repository.Item `json:"data"`
}

type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*Query, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, q *Query) (*Response, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	items, err := h.repo.ListItems(ctx, tenant, q.CycleID, q.Search)
	if err != nil {
		logger.FromContext(ctx).Error("failed to list salary raise items", zap.Error(err))
		return nil, errs.Internal("failed to list salary raise items")
	}
	return &Response{Data: items}, nil
}
