package get

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"

	"hrms/modules/debt/internal/dto"
	"hrms/modules/debt/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

type Query struct {
	ID uuid.UUID
}

type Response struct {
	dto.Item
}

type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*Query, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, q *Query) (*Response, error) {
	rec, err := h.repo.Get(ctx, q.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("debt transaction not found")
		}
		return nil, errs.Internal("failed to get debt transaction")
	}
	item := dto.FromRecord(*rec)
	if rec.TxnType == "loan" || rec.TxnType == "other" {
		children, err := h.repo.GetInstallments(ctx, rec.ID)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return nil, errs.Internal("failed to load installments")
		}
		for _, ch := range children {
			item.Installments = append(item.Installments, dto.FromRecord(ch))
		}
	}
	return &Response{Item: item}, nil
}
