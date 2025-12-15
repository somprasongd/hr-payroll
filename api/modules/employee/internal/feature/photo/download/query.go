package download

import (
	"context"
	"database/sql"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
)

type Query struct {
	ID uuid.UUID
}

type Response struct {
	Record repository.PhotoRecord
}

type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*Query, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, q *Query) (*Response, error) {
	rec, err := h.repo.GetPhoto(ctx, q.ID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errs.NotFound("photo not found")
		}
		logger.FromContext(ctx).Error("failed to get employee photo", zap.Error(err), zap.String("id", q.ID.String()))
		return nil, errs.Internal("failed to get employee photo")
	}
	return &Response{Record: *rec}, nil
}
