package updaterole

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"

	"hrms/modules/user/internal/dto"
	"hrms/modules/user/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

type Command struct {
	ID    uuid.UUID
	Role  string
	Actor uuid.UUID
}

type Response struct {
	dto.User
}

type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	if cmd.Role != "admin" && cmd.Role != "hr" {
		return nil, errs.BadRequest("invalid role")
	}

	if err := h.repo.UpdateRole(ctx, cmd.ID, cmd.Role, cmd.Actor); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("user not found")
		}
		return nil, errs.Internal("failed to update role")
	}

	user, err := h.repo.GetUser(ctx, cmd.ID)
	if err != nil {
		return nil, errs.Internal("failed to fetch updated user")
	}
	return &Response{User: dto.FromRecord(*user)}, nil
}
