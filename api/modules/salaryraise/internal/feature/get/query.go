package get

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/salaryraise/internal/dto"
	"hrms/modules/salaryraise/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
)

type Query struct {
	ID   uuid.UUID
	Repo repository.Repository
}

type Response struct {
	dto.Cycle
}

type Handler struct{}

var _ mediator.RequestHandler[*Query, *Response] = (*Handler)(nil)

func NewHandler() *Handler { return &Handler{} }

func (h *Handler) Handle(ctx context.Context, q *Query) (*Response, error) {
	c, items, err := q.Repo.Get(ctx, q.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("cycle not found")
		}
		logger.FromContext(ctx).Error("failed to get salary raise cycle", zap.Error(err))
		return nil, errs.Internal("failed to get cycle")
	}
	out := dto.FromCycle(*c)
	for _, it := range items {
		out.Items = append(out.Items, dto.FromItem(it))
	}
	return &Response{Cycle: out}, nil
}
