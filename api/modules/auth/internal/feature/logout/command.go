package logout

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"hrms/modules/auth/internal/repository"
	"hrms/modules/auth/internal/service"
	"hrms/shared/common/errs"
	"hrms/shared/common/jwt"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/validator"

	"go.uber.org/zap"
)

type Command struct {
	RefreshToken string `validate:"required"`
}

type Handler struct {
	tokenSvc *jwt.TokenService
	repo     repository.Repository
}

var _ mediator.RequestHandler[*Command, mediator.NoResponse] = (*Handler)(nil)

func NewHandler(tokenSvc *jwt.TokenService, repo repository.Repository) *Handler {
	return &Handler{
		tokenSvc: tokenSvc,
		repo:     repo,
	}
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (mediator.NoResponse, error) {
	cmd.RefreshToken = strings.TrimSpace(cmd.RefreshToken)
	if err := validator.Validate(cmd); err != nil {
		return mediator.NoResponse{}, err
	}

	claims, err := h.tokenSvc.ParseRefreshToken(cmd.RefreshToken)
	if err != nil {
		return mediator.NoResponse{}, errs.Unauthorized("invalid refresh token")
	}

	tokenHash := service.HashRefreshToken(cmd.RefreshToken)
	rec, err := h.repo.GetRefreshToken(ctx, tokenHash)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.Unauthorized("refresh token not found")
		}
		logger.FromContext(ctx).Error("failed to load refresh token", zap.Error(err))
		return mediator.NoResponse{}, errs.Internal("failed to revoke token")
	}
	if rec.UserID != claims.UserID {
		return mediator.NoResponse{}, errs.Forbidden("token does not belong to user")
	}
	if rec.RevokedAt.Valid {
		return mediator.NoResponse{}, nil
	}
	if time.Now().After(rec.ExpiresAt) {
		return mediator.NoResponse{}, errs.Unauthorized("refresh token is expired")
	}

	if err := h.repo.RevokeRefreshToken(ctx, tokenHash); err != nil {
		logger.FromContext(ctx).Error("failed to revoke refresh token", zap.Error(err))
		return mediator.NoResponse{}, errs.Internal("failed to revoke token")
	}

	return mediator.NoResponse{}, nil
}
