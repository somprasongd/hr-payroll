package checkduplicate

import (
	"context"

	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

type Query struct {
	EmployeeNumber string    `validate:"required"`
	ExcludeID      uuid.UUID // Optional: exclude this employee ID (for edit mode)
}

type Response struct {
	IsDuplicate bool `json:"isDuplicate"`
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

	isDuplicate, err := h.repo.CheckEmployeeNumberExists(ctx, tenant, q.EmployeeNumber, q.ExcludeID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to check employee number duplicate",
			zap.Error(err),
			zap.String("employeeNumber", q.EmployeeNumber),
			zap.String("excludeId", q.ExcludeID.String()))
		return nil, errs.Internal("failed to check employee number")
	}

	return &Response{IsDuplicate: isDuplicate}, nil
}
