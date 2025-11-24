package changepassword

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"

	"hrms/modules/user/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/password"
)

type Command struct {
	UserID          uuid.UUID
	CurrentPassword string
	NewPassword     string
}

type Response struct {
	Message string `json:"message"`
}

type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	if cmd.CurrentPassword == "" || cmd.NewPassword == "" {
		return nil, errs.BadRequest("currentPassword and newPassword are required")
	}

	rec, err := h.repo.GetUser(ctx, cmd.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("user not found")
		}
		return nil, errs.Internal("failed to load user")
	}

	valid, err := password.Verify(cmd.CurrentPassword, rec.PasswordHash)
	if err != nil {
		return nil, errs.Internal("failed to verify password")
	}
	if !valid {
		return nil, errs.BadRequest("currentPassword is incorrect")
	}
	if cmd.CurrentPassword == cmd.NewPassword {
		return nil, errs.Unprocessable("newPassword must be different from currentPassword")
	}

	hash, err := password.Hash(cmd.NewPassword)
	if err != nil {
		return nil, errs.Internal("failed to hash password")
	}

	if err := h.repo.ResetPassword(ctx, cmd.UserID, hash, cmd.UserID); err != nil {
		return nil, errs.Internal("failed to change password")
	}

	return &Response{Message: "Password changed successfully."}, nil
}
