package update

import (
	"context"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/branch/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/validator"
	"hrms/shared/events"
)

type Command struct {
	ID      uuid.UUID `validate:"required"`
	Code    string    `validate:"required"`
	Name    string    `validate:"required"`
	Status  string    `validate:"required"`
	ActorID uuid.UUID `validate:"required"`
}

type Response struct {
	Branch *repository.Branch `json:"branch"`
}

type commandHandler struct {
	repo repository.Repository
	eb   eventbus.EventBus
}

func NewHandler(repo repository.Repository, eb eventbus.EventBus) *commandHandler {
	return &commandHandler{repo: repo, eb: eb}
}

func (h *commandHandler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	if err := validator.Validate(cmd); err != nil {
		return nil, err
	}

	// Rule 2: Cannot edit suspended or archived branches
	existing, err := h.repo.GetByID(ctx, cmd.ID)
	if err != nil {
		return nil, errs.NotFound("branch not found")
	}
	if existing.Status == "suspended" || existing.Status == "archived" {
		return nil, errs.BadRequest("cannot edit suspended or archived branch, use status change endpoint instead")
	}

	branch, err := h.repo.Update(ctx, cmd.ID, cmd.Code, cmd.Name, cmd.Status, cmd.ActorID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to update branch", zap.Error(err))
		return nil, errs.NotFound("branch not found")
	}

	companyID := branch.CompanyID
	h.eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		CompanyID:  &companyID,
		BranchID:   nil,
		Action:     "UPDATE",
		EntityName: "BRANCH",
		EntityID:   branch.ID.String(),
		Details: map[string]interface{}{
			"code":       branch.Code,
			"name":       branch.Name,
			"status":     branch.Status,
			"is_default": branch.IsDefault,
		},
		Timestamp: branch.UpdatedAt,
	})

	return &Response{Branch: branch}, nil
}
