package update

import (
	"context"

	"hrms/modules/company/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/validator"
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
}

func NewHandler(repo repository.Repository) *commandHandler {
	return &commandHandler{repo: repo}
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

	return &Response{Company: company}, nil
}
