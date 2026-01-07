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

	companyID := branch.CompanyID

	if err := h.repo.SetDefault(ctx, cmd.ID, cmd.ActorID); err != nil {
		logger.FromContext(ctx).Error("failed to set default branch", zap.Error(err))
		return mediator.NoResponse{}, errs.NotFound("branch not found")
	}

	updatedBranch, err := h.repo.GetByID(ctx, cmd.ID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to reload branch after set default", zap.Error(err))
		updatedBranch = branch
		updatedBranch.IsDefault = true
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		CompanyID:  &companyID,
		BranchID:   nil,
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
