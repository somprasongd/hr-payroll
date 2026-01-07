package changepassword

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/user/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/password"
	"hrms/shared/common/validator"
)

type Command struct {
	UserID          uuid.UUID `validate:"required"`
	CurrentPassword string    `validate:"required"`
	NewPassword     string    `validate:"required"`
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
	if err := validator.Validate(cmd); err != nil {
		return nil, err
	}

	rec, err := h.repo.GetUser(ctx, cmd.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("user not found")
		}
		logger.FromContext(ctx).Error("failed to load user for password change", zap.Error(err))
		return nil, errs.Internal("failed to load user")
	}

	valid, err := password.Verify(cmd.CurrentPassword, rec.PasswordHash)
	if err != nil {
		logger.FromContext(ctx).Error("failed to verify password", zap.Error(err))
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
		logger.FromContext(ctx).Error("failed to hash password", zap.Error(err))
		return nil, errs.Internal("failed to hash password")
	}

	if err := h.repo.ResetPassword(ctx, cmd.UserID, hash, cmd.UserID); err != nil {
		logger.FromContext(ctx).Error("failed to change password", zap.Error(err))
		return nil, errs.Internal("failed to change password")
	}

	return &Response{Message: "Password changed successfully."}, nil
}
