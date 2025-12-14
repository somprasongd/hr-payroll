package effective

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"go.uber.org/zap"

	"hrms/modules/payrollorgprofile/internal/dto"
	"hrms/modules/payrollorgprofile/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
)

type Query struct {
	Date time.Time
}

type Response struct {
	Profile dto.Profile `json:"profile"`
}

type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*Query, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, q *Query) (*Response, error) {
	// date already defaulted in endpoint; keep guard for safety
	if q.Date.IsZero() {
		q.Date = time.Now()
	}
	rec, err := h.repo.GetEffective(ctx, q.Date)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			logger.FromContext(ctx).Warn("org profile not found for date", zap.Time("date", q.Date), zap.Error(err))
			return nil, errs.NotFound("org profile not found for date")
		}
		logger.FromContext(ctx).Error("failed to get effective org profile", zap.Error(err), zap.Time("date", q.Date))
		return nil, errs.Internal("failed to get effective org profile")
	}
	return &Response{Profile: dto.FromRecord(*rec)}, nil
}
