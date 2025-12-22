package items

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/bonus/internal/dto"
	"hrms/modules/bonus/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
	"hrms/shared/events"
)

type UpdateCommand struct {
	ID          uuid.UUID
	BonusMonths *float64 `json:"bonusMonths"`
	BonusAmount *float64 `json:"bonusAmount"`
	Actor       uuid.UUID
	Repo        repository.Repository
	Eb          eventbus.EventBus
}

type UpdateResponse struct {
	dto.Item
}

type updateHandler struct{}

func NewUpdateHandler() *updateHandler { return &updateHandler{} }

func (h *updateHandler) Handle(ctx context.Context, cmd *UpdateCommand) (*UpdateResponse, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	_, cycle, err := cmd.Repo.GetItem(ctx, tenant, cmd.ID)
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
	updated, err := cmd.Repo.UpdateItem(ctx, tenant, cmd.ID, cmd.BonusMonths, cmd.BonusAmount, cmd.Actor)
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

	cmd.Eb.Publish(events.LogEvent{
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

// @Summary Update bonus item
// @Tags Bonus
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "item id"
// @Param request body UpdateCommand true "payload"
// @Success 200 {object} UpdateResponse
// @Router /bonus-items/{id} [patch]
func RegisterUpdate(router fiber.Router, repo repository.Repository, eb eventbus.EventBus) {
	router.Patch("/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid item id")
		}
		var req UpdateCommand
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}
		req.ID = id
		req.Actor = user.ID
		req.Repo = repo
		req.Eb = eb

		resp, err := mediator.Send[*UpdateCommand, *UpdateResponse](c.Context(), &req)
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Item)
	})
}
