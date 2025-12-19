package createwithpassword

import (
	"context"

	"go.uber.org/zap"

	"hrms/modules/user/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/password"
	"hrms/shared/contracts"
)

type Handler struct {
	repo repository.Repository
}

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, cmd *contracts.CreateUserWithPasswordCommand) (*contracts.CreateUserWithPasswordResponse, error) {
	// Hash password
	hash, err := password.Hash(cmd.PlainPassword)
	if err != nil {
		logger.FromContext(ctx).Error("failed to hash password", zap.Error(err))
		return nil, errs.Internal("failed to create user")
	}

	// Create user
	user, err := h.repo.CreateUser(ctx, cmd.Username, hash, cmd.Role, cmd.ActorID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to create user", zap.Error(err))
		return nil, errs.Internal("failed to create user")
	}

	return &contracts.CreateUserWithPasswordResponse{UserID: user.ID}, nil
}
