package create

import (
	"context"

	"go.uber.org/zap"

	"hrms/modules/branch/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/events"
)

type Command struct {
	Repo repository.Repository
	Eb   eventbus.EventBus
	Code string
	Name string
}

type Response struct {
	Branch *repository.Branch `json:"branch"`
}

type commandHandler struct{}

func NewHandler() *commandHandler {
	return &commandHandler{}
}

func (h *commandHandler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing user context")
	}

	branch, err := cmd.Repo.Create(ctx, cmd.Code, cmd.Name, user.ID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to create branch", zap.Error(err))
		return nil, errs.Internal("failed to create branch")
	}

	companyID := branch.CompanyID
	cmd.Eb.Publish(events.LogEvent{
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
