package update

import (
	"context"

	"hrms/modules/company/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
)

type Command struct {
	Repo repository.Repository
	Code string
	Name string
}

type Response struct {
	Company *repository.Company `json:"company"`
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

	company, err := cmd.Repo.Update(ctx, cmd.Code, cmd.Name, user.ID)
	if err != nil {
		return nil, errs.Internal("failed to update company")
	}

	return &Response{Company: company}, nil
}
