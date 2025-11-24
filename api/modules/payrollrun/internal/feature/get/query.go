package get

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"

	"hrms/modules/payrollrun/internal/dto"
	"hrms/modules/payrollrun/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

type Query struct {
	ID   uuid.UUID
	Repo repository.Repository
}

type Response struct {
	dto.Run
}

type Handler struct{}

var _ mediator.RequestHandler[*Query, *Response] = (*Handler)(nil)

func NewHandler() *Handler { return &Handler{} }

func (h *Handler) Handle(ctx context.Context, q *Query) (*Response, error) {
	run, err := q.Repo.Get(ctx, q.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("payroll run not found")
		}
		return nil, errs.Internal("failed to get payroll run")
	}
	return &Response{Run: dto.FromRun(*run)}, nil
}
