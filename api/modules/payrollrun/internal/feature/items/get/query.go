package itemsget

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

type GetQuery struct {
	ID uuid.UUID
}

type GetResponse struct {
	dto.ItemDetail
}

type getHandler struct {
	repo repository.Repository
}

func NewGetHandler(repo repository.Repository) *getHandler {
	return &getHandler{repo: repo}
}

var _ mediator.RequestHandler[*GetQuery, *GetResponse] = (*getHandler)(nil)

func (h *getHandler) Handle(ctx context.Context, q *GetQuery) (*GetResponse, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}
	item, err := h.repo.GetItemDetail(ctx, tenant, q.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("payroll item not found")
		}
		logger.FromContext(ctx).Error("failed to load payroll item", zap.Error(err))
		return nil, errs.Internal("failed to load payroll item")
	}
	return &GetResponse{ItemDetail: dto.FromItemDetail(*item)}, nil
}
