package ft

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/worklog/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/events"
)

type DeleteCommand struct {
	ID    uuid.UUID
	Actor uuid.UUID
	Repo  repository.FTRepository
	Eb    eventbus.EventBus
}

type deleteHandler struct{}

func NewDeleteHandler() *deleteHandler { return &deleteHandler{} }

func (h *deleteHandler) Handle(ctx context.Context, cmd *DeleteCommand) (mediator.NoResponse, error) {
	rec, err := cmd.Repo.Get(ctx, cmd.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("worklog not found")
		}
		logger.FromContext(ctx).Error("failed to load worklog", zap.Error(err))
		return mediator.NoResponse{}, errs.Internal("failed to load worklog")
	}
	if rec.Status != "pending" {
		return mediator.NoResponse{}, errs.BadRequest("cannot delete non-pending worklog")
	}
	if err := cmd.Repo.SoftDelete(ctx, cmd.ID, cmd.Actor); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("worklog not found")
		}
		logger.FromContext(ctx).Error("failed to delete worklog", zap.Error(err))
		return mediator.NoResponse{}, errs.Internal("failed to delete worklog")
	}

	cmd.Eb.Publish(events.LogEvent{
		ActorID:    cmd.Actor,
		Action:     "DELETE",
		EntityName: "WORKLOG_FT",
		EntityID:   cmd.ID.String(),
		Details: map[string]interface{}{
			"deleted_worklog_id": cmd.ID.String(),
		},
		Timestamp: time.Now(),
	})

	return mediator.NoResponse{}, nil
}

// @Summary Delete worklog FT
// @Description ลบ worklog (Full-time) ได้เฉพาะสถานะ pending
// @Tags Worklogs FT
// @Security BearerAuth
// @Param id path string true "worklog id"
// @Success 204 "No Content"
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Router /worklogs/ft/{id} [delete]
func registerDelete(router fiber.Router, repo repository.FTRepository, eb eventbus.EventBus) {
	router.Delete("/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}
		if _, err := mediator.Send[*DeleteCommand, mediator.NoResponse](c.Context(), &DeleteCommand{
			ID:    id,
			Actor: user.ID,
			Repo:  repo,
			Eb:    eb,
		}); err != nil {
			return err
		}
		return c.SendStatus(fiber.StatusNoContent)
	})
}
