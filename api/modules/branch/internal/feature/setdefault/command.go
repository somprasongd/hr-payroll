package setdefault

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
	branch, err := cmd.Repo.GetByID(ctx, cmd.ID)
	if err != nil {
		return mediator.NoResponse{}, errs.NotFound("branch not found")
	}

	companyID := branch.CompanyID
	branchID := branch.ID

	if err := cmd.Repo.SetDefault(ctx, cmd.ID, cmd.ActorID); err != nil {
		logger.FromContext(ctx).Error("failed to set default branch", zap.Error(err))
		return mediator.NoResponse{}, errs.NotFound("branch not found")
	}

	updatedBranch, err := cmd.Repo.GetByID(ctx, cmd.ID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to reload branch after set default", zap.Error(err))
		updatedBranch = branch
		updatedBranch.IsDefault = true
	}

	cmd.Eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		CompanyID:  &companyID,
		BranchID:   &branchID,
		Action:     "SET_DEFAULT",
		EntityName: "BRANCH",
		EntityID:   updatedBranch.ID.String(),
		Details: map[string]interface{}{
			"code":       updatedBranch.Code,
			"name":       updatedBranch.Name,
			"status":     updatedBranch.Status,
			"is_default": updatedBranch.IsDefault,
		},
		Timestamp: time.Now(),
	})

	return mediator.NoResponse{}, nil
}
