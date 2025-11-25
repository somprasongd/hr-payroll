package effective

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"go.uber.org/zap"
	"hrms/modules/payrollconfig/internal/dto"
	"hrms/modules/payrollconfig/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
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
		if errors.Is(err, sql.ErrNoRows) {
			logger.FromContext(ctx).Warn("payroll config not found for date", zap.Time("date", q.Date), zap.Error(err))
			return nil, errs.NotFound("config not found for date")
		}
		logger.FromContext(ctx).Error("failed to get effective payroll config", zap.Error(err), zap.Time("date", q.Date))
		return nil, errs.Internal("failed to get effective payroll config")
	}
	return &Response{Config: dto.FromRecord(*rec)}, nil
}
