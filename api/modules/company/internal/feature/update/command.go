package update

import (
	"context"

	"time"

	"hrms/modules/company/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/validator"
	"hrms/shared/events"
)

type Command struct {
	Code string `validate:"required"`
	Name string `validate:"required"`
}

type Response struct {
	Company *repository.Company `json:"company"`
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

	company, err := h.repo.Update(ctx, cmd.Code, cmd.Name, user.ID)
	if err != nil {
		return nil, errs.Internal("failed to update company")
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  &company.ID,
		BranchID:   nil,
		Action:     "UPDATE",
		EntityName: "COMPANY",
		EntityID:   company.ID.String(),
		Details: map[string]interface{}{
			"code":   company.Code,
			"name":   company.Name,
			"status": company.Status,
		},
		Timestamp: time.Now(),
	})

	return &Response{Company: company}, nil
}
