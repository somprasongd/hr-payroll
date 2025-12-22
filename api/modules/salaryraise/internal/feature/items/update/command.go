package itemsupdate

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/salaryraise/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/events"
)

type Command struct {
	ID           uuid.UUID
	RaisePercent *float64 `json:"raisePercent"`
	RaiseAmount  *float64 `json:"raiseAmount"`
	NewSSOWage   *float64 `json:"newSsoWage"`
}

type Response struct {
	repository.Item
}

type Handler struct {
	repo repository.Repository
	eb   eventbus.EventBus
}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository, eb eventbus.EventBus) *Handler {
	return &Handler{repo: repo, eb: eb}
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing user context")
	}

	_, cycle, err := h.repo.GetItem(ctx, tenant, cmd.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("raise item not found")
		}
		logger.FromContext(ctx).Error("failed to load raise item", zap.Error(err))
		return nil, errs.Internal("failed to load raise item")
	}
	if cycle.Status != "pending" {
		return nil, errs.BadRequest("can edit items only when cycle pending")
	}
	if cmd.RaisePercent == nil && cmd.RaiseAmount == nil && cmd.NewSSOWage == nil {
		return nil, errs.BadRequest("no fields to update")
	}
	updated, err := h.repo.UpdateItem(ctx, tenant, cmd.ID, cmd.RaisePercent, cmd.RaiseAmount, cmd.NewSSOWage, user.ID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to update raise item", zap.Error(err))
		return nil, errs.Internal("failed to update raise item")
	}

	details := map[string]interface{}{
		"raise_item_id": updated.ID.String(),
	}
	if cmd.RaisePercent != nil {
		details["raise_percent"] = *cmd.RaisePercent
	}
	if cmd.RaiseAmount != nil {
		details["raise_amount"] = *cmd.RaiseAmount
	}
	if cmd.NewSSOWage != nil {
		details["new_sso_wage"] = *cmd.NewSSOWage
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  &tenant.CompanyID,
		BranchID:   tenant.BranchIDPtr(),
		Action:     "UPDATE_ITEM",
		EntityName: "SALARY_RAISE_ITEM",
		EntityID:   updated.ID.String(),
		Details:    details,
		Timestamp:  time.Now(),
	})

	return &Response{Item: *updated}, nil
}
