package delete

import (
	"context"

	"github.com/google/uuid"

	"hrms/modules/company/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
)

type Command struct {
	ID uuid.UUID
}

type Response struct{}

type commandHandler struct {
	repo repository.Repository
}

func NewHandler(repo repository.Repository) *commandHandler {
	return &commandHandler{repo: repo}
}

func (h *commandHandler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing user context")
	}

	if err := h.repo.DeleteBankAccount(ctx, cmd.ID, user.ID); err != nil {
		return nil, errs.Internal("failed to delete bank account")
	}

	return &Response{}, nil
}
