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
	Repo    repository.Repository
	Eb      eventbus.EventBus
	ID      uuid.UUID
	ActorID uuid.UUID
}

type commandHandler struct{}

func NewHandler() *commandHandler {
	return &commandHandler{}
}

func (h *commandHandler) Handle(ctx context.Context, cmd *Command) (mediator.NoResponse, error) {
	// First check the branch status
	branch, err := cmd.Repo.GetByID(ctx, cmd.ID)
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

	if err := cmd.Repo.Delete(ctx, cmd.ID, cmd.ActorID); err != nil {
		logger.FromContext(ctx).Error("failed to delete branch", zap.Error(err))
		return mediator.NoResponse{}, errs.BadRequest("cannot delete this branch")
	}

	companyID := branch.CompanyID
	branchID := branch.ID
	cmd.Eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		CompanyID:  &companyID,
		BranchID:   &branchID,
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
