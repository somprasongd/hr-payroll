package effective

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"time"

	"hrms/modules/payrollconfig/internal/dto"
	"hrms/modules/payrollconfig/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

type Query struct {
	Date time.Time
}

type Response struct {
	dto.Config
}

type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*Query, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, q *Query) (*Response, error) {
	if q.Date.IsZero() {
		q.Date = time.Now()
	}
	rec, err := h.repo.GetEffective(ctx, q.Date)
	if err != nil {
		log.Println(err)
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("config not found for date")
		}
		return nil, errs.Internal("failed to get effective payroll config")
	}
	return &Response{Config: dto.FromRecord(*rec)}, nil
}
