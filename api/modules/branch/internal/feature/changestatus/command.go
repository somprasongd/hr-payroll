package changestatus

import (
	"context"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/branch/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/events"
)

type Command struct {
	ID        uuid.UUID
	NewStatus string
	ActorID   uuid.UUID
}

type Response struct {
	Branch        *repository.Branch `json:"branch"`
	EmployeeCount int                `json:"employeeCount"`
}

type commandHandler struct {
	repo repository.Repository
	eb   eventbus.EventBus
}

func NewHandler(repo repository.Repository, eb eventbus.EventBus) *commandHandler {
	return &commandHandler{repo: repo, eb: eb}
}

func (h *commandHandler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	// Get current branch
	branch, err := h.repo.GetByID(ctx, cmd.ID)
	if err != nil {
		return nil, errs.NotFound("branch not found")
	}

	// Rule 1: Cannot change status of default branch to non-active
	if branch.IsDefault && cmd.NewStatus != "active" {
		return nil, errs.BadRequest("cannot suspend or archive default branch")
	}

	// Rule 3: Validate status transitions
	currentStatus := branch.Status

	// archived → suspended is not allowed
	if currentStatus == "archived" && cmd.NewStatus == "suspended" {
		return nil, errs.BadRequest("cannot change from archived to suspended")
	}

	// Get employee count (for warning when archiving)
	employeeCount := 0
	if cmd.NewStatus == "archived" {
		count, err := h.repo.GetEmployeeCountByBranch(ctx, cmd.ID)
		if err != nil {
			logger.FromContext(ctx).Error("failed to get employee count", zap.Error(err))
		} else {
			employeeCount = count
		}
	}

	// Update status
	updatedBranch, err := h.repo.UpdateStatus(ctx, cmd.ID, cmd.NewStatus, cmd.ActorID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to update branch status", zap.Error(err))
		return nil, errs.Internal("failed to update branch status")
	}

	companyID := updatedBranch.CompanyID
	h.eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		CompanyID:  &companyID,
		BranchID:   nil,
		Action:     "UPDATE_STATUS",
		EntityName: "BRANCH",
		EntityID:   updatedBranch.ID.String(),
		Details: map[string]interface{}{
			"code":          updatedBranch.Code,
			"name":          updatedBranch.Name,
			"status":        updatedBranch.Status,
			"old_status":    currentStatus,
			"is_default":    updatedBranch.IsDefault,
			"employeeCount": employeeCount,
		},
		Timestamp: updatedBranch.UpdatedAt,
	})

	return &Response{
		Branch:        updatedBranch,
		EmployeeCount: employeeCount,
	}, nil
}
