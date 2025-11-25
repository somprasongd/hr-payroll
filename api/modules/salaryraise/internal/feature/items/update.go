package items

import (
	"context"
	"database/sql"
	"errors"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/salaryraise/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

type UpdateCommand struct {
	ID           uuid.UUID
	RaisePercent *float64 `json:"raisePercent"`
	RaiseAmount  *float64 `json:"raiseAmount"`
	NewSSOWage   *float64 `json:"newSsoWage"`
	ActorID      uuid.UUID
	Repo         repository.Repository
}

type UpdateResponse struct {
	repository.Item
}

type updateHandler struct{}

func NewUpdateHandler() *updateHandler { return &updateHandler{} }

func (h *updateHandler) Handle(ctx context.Context, cmd *UpdateCommand) (*UpdateResponse, error) {
	_, cycle, err := cmd.Repo.GetItem(ctx, cmd.ID)
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
	updated, err := cmd.Repo.UpdateItem(ctx, cmd.ID, cmd.RaisePercent, cmd.RaiseAmount, cmd.NewSSOWage, cmd.ActorID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to update raise item", zap.Error(err))
		return nil, errs.Internal("failed to update raise item")
	}
	return &UpdateResponse{Item: *updated}, nil
}

// @Summary Update salary raise item
// @Tags Salary Raise
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "item id"
// @Param request body UpdateCommand true "payload"
// @Success 200 {object} UpdateResponse
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Router /salary-raise-items/{id} [patch]
func RegisterUpdate(router fiber.Router, repo repository.Repository) {
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
		req.ActorID = user.ID
		req.Repo = repo

		resp, err := mediator.Send[*UpdateCommand, *UpdateResponse](c.Context(), &req)
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Item)
	})
}
