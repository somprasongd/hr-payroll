package update

import (
	"context"

	"github.com/google/uuid"

	"hrms/modules/company/internal/repository"
	"hrms/shared/common/errs"
)


type Command struct {
	Repo    repository.Repository
	Code    string
	Name    string
	ActorID uuid.UUID
}

type Response struct {
	Company *repository.Company `json:"company"`
}

type commandHandler struct{}

func NewHandler() *commandHandler {
	return &commandHandler{}
}

func (h *commandHandler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	company, err := cmd.Repo.Update(ctx, cmd.Code, cmd.Name, cmd.ActorID)
	if err != nil {
		return nil, errs.Internal("failed to update company")
	}

	return &Response{Company: company}, nil
}
