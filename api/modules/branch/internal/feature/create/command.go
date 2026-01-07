package create

import (
	"context"

	"go.uber.org/zap"

	"hrms/modules/branch/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/validator"
	"hrms/shared/events"
)

type Command struct {
	Code string `validate:"required"`
	Name string `validate:"required"`
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

	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing user context")
	}

	branch, err := h.repo.Create(ctx, cmd.Code, cmd.Name, user.ID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to create branch", zap.Error(err))
		return nil, errs.Internal("failed to create branch")
	}

	companyID := branch.CompanyID
	h.eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  &companyID,
		BranchID:   nil,
		Action:     "CREATE",
		EntityName: "BRANCH",
		EntityID:   branch.ID.String(),
		Details: map[string]interface{}{
			"code":       branch.Code,
			"name":       branch.Name,
			"status":     branch.Status,
			"is_default": branch.IsDefault,
		},
		Timestamp: branch.CreatedAt,
	})

	return &Response{Branch: branch}, nil
}
