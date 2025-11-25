package list

import (
	"context"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
)

type Query struct {
	EmployeeID uuid.UUID
}

type Response struct {
	Data []repository.AccumRecord `json:"data"`
}

type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*Query, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, q *Query) (*Response, error) {
	data, err := h.repo.ListAccum(ctx, q.EmployeeID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to list accumulations", zap.Error(err))
		return nil, err
	}
	if data == nil {
		data = make([]repository.AccumRecord, 0)
	}
	return &Response{Data: data}, nil
}
