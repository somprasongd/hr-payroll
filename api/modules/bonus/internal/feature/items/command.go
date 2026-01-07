package items

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/bonus/internal/dto"
	"hrms/modules/bonus/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/events"
)

type UpdateCommand struct {
	ID          uuid.UUID
	BonusMonths *float64 `json:"bonusMonths"`
	BonusAmount *float64 `json:"bonusAmount"`
	Actor       uuid.UUID
}

type UpdateResponse struct {
	dto.Item
}

type updateHandler struct {
	repo repository.Repository
	eb   eventbus.EventBus
}

func NewUpdateHandler(repo repository.Repository, eb eventbus.EventBus) *updateHandler {
	return &updateHandler{repo: repo, eb: eb}
}

func (h *updateHandler) Handle(ctx context.Context, cmd *UpdateCommand) (*UpdateResponse, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	_, cycle, err := h.repo.GetItem(ctx, tenant, cmd.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("bonus item not found")
		}
		logger.FromContext(ctx).Error("failed to load bonus item", zap.Error(err))
		return nil, errs.Internal("failed to load bonus item")
	}
	if cycle.Status != "pending" {
		return nil, errs.BadRequest("can edit items only when cycle pending")
	}
	if cmd.BonusAmount == nil && cmd.BonusMonths == nil {
		return nil, errs.BadRequest("no fields to update")
	}
	updated, err := h.repo.UpdateItem(ctx, tenant, cmd.ID, cmd.BonusMonths, cmd.BonusAmount, cmd.Actor)
	if err != nil {
		logger.FromContext(ctx).Error("failed to update bonus item", zap.Error(err))
		return nil, errs.Internal("failed to update bonus item")
	}
	details := map[string]interface{}{}
	if cmd.BonusMonths != nil {
		details["bonusMonths"] = *cmd.BonusMonths
	}
	if cmd.BonusAmount != nil {
		details["bonusAmount"] = *cmd.BonusAmount
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    cmd.Actor,
		CompanyID:  &tenant.CompanyID,
		BranchID:   tenant.BranchIDPtr(),
		Action:     "UPDATE_ITEM",
		EntityName: "BONUS_ITEM",
		EntityID:   updated.ID.String(),
		Details:    details,
		Timestamp:  time.Now(),
	})

	return &UpdateResponse{Item: dto.FromItem(*updated)}, nil
}
