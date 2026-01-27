package get

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/payrollrun/internal/dto"
	"hrms/modules/payrollrun/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
)

type Query struct {
	ID uuid.UUID
}

type Response struct {
	dto.Run
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
	run, err := h.repo.Get(ctx, tenant, q.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("payroll run not found")
		}
		logger.FromContext(ctx).Error("failed to get payroll run", zap.Error(err))
		return nil, errs.Internal("failed to get payroll run")
	}
	return &Response{Run: dto.FromRun(*run)}, nil
}
