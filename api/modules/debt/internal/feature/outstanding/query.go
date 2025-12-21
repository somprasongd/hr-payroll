package outstanding

import (
	"context"
	"math"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/debt/internal/dto"
	"hrms/modules/debt/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
)

type Query struct {
	EmployeeID uuid.UUID
}

type Response struct {
	EmployeeID        uuid.UUID  `json:"employeeId"`
	EmployeeName      string     `json:"employeeName,omitempty"`
	OutstandingAmount float64    `json:"outstandingAmount"`
	Installments      []dto.Item `json:"installments"`
	Meta              dto.Meta   `json:"meta"`
}

type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*Query, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, q *Query) (*Response, error) {
	if q.EmployeeID == uuid.Nil {
		return nil, errs.BadRequest("employeeId is required")
	}

	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	rows, err := h.repo.PendingInstallmentsByEmployee(ctx, tenant, q.EmployeeID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to load pending installments", zap.Error(err))
		return nil, errs.Internal("failed to load pending installments")
	}

	inst := make([]dto.Item, 0, len(rows))
	sum := 0.0
	name := ""
	for _, r := range rows {
		if name == "" {
			name = r.EmployeeName
		}
		inst = append(inst, dto.FromRecord(r))
		sum += r.Amount
	}

	return &Response{
		EmployeeID:        q.EmployeeID,
		EmployeeName:      name,
		OutstandingAmount: math.Round(sum*100) / 100, // keep currency scale
		Installments:      inst,
		Meta: dto.Meta{
			CurrentPage: 1,
			TotalPages:  1,
			TotalItems:  len(inst),
		},
	}, nil
}
