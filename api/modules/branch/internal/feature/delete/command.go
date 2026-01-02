package delete

import (
	"context"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/branch/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/events"
)

type Command struct {
	ID      uuid.UUID
	ActorID uuid.UUID
}

type commandHandler struct {
	repo repository.Repository
	eb   eventbus.EventBus
}

func NewHandler(repo repository.Repository, eb eventbus.EventBus) *commandHandler {
	return &commandHandler{repo: repo, eb: eb}
}

func (h *commandHandler) Handle(ctx context.Context, cmd *Command) (mediator.NoResponse, error) {
	branch, err := h.repo.GetByID(ctx, cmd.ID)
	if err != nil {
		return mediator.NoResponse{}, errs.NotFound("branch not found")
	}

	// Rule: Cannot delete default branch
	if branch.IsDefault {
		return mediator.NoResponse{}, errs.BadRequest("cannot delete default branch")
	}

	// Rule: Can only delete archived branches
	if branch.Status != "archived" {
		return mediator.NoResponse{}, errs.BadRequest("branch must be archived before deletion")
	}

	if err := h.repo.Delete(ctx, cmd.ID, cmd.ActorID); err != nil {
		logger.FromContext(ctx).Error("failed to delete branch", zap.Error(err))
		return mediator.NoResponse{}, errs.BadRequest("cannot delete this branch")
	}

	companyID := branch.CompanyID
	h.eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		CompanyID:  &companyID,
		BranchID:   nil,
		Action:     "DELETE",
		EntityName: "BRANCH",
		EntityID:   branch.ID.String(),
		Details: map[string]interface{}{
			"code":       branch.Code,
			"name":       branch.Name,
			"status":     branch.Status,
			"is_default": branch.IsDefault,
		},
		Timestamp: time.Now(),
	})

	return mediator.NoResponse{}, nil
}
