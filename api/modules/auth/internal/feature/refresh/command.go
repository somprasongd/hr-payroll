package refresh

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
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/common/validator"

	"go.uber.org/zap"
)

type Command struct {
	RefreshToken string `validate:"required"`
}

type Response struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresIn    int64  `json:"expiresIn"`
}

type Handler struct {
	tokenSvc *jwt.TokenService
	repo     repository.Repository
	tx       transactor.Transactor
}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler(tokenSvc *jwt.TokenService, repo repository.Repository, tx transactor.Transactor) *Handler {
	return &Handler{
		tokenSvc: tokenSvc,
		repo:     repo,
		tx:       tx,
	}
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	cmd.RefreshToken = strings.TrimSpace(cmd.RefreshToken)
	if err := validator.Validate(cmd); err != nil {
		return nil, err
	}

	claims, err := h.tokenSvc.ParseRefreshToken(cmd.RefreshToken)
	if err != nil {
		logger.FromContext(ctx).Warn("refresh token validation failed", zap.Error(err))
		return nil, errs.Unauthorized("invalid or expired refresh token")
	}

	tokenHash := service.HashRefreshToken(cmd.RefreshToken)
	rec, err := h.repo.GetRefreshToken(ctx, tokenHash)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			logger.FromContext(ctx).Warn("refresh token not found in db", zap.String("hash", tokenHash))
			return nil, errs.Unauthorized("refresh token not found")
		}
		logger.FromContext(ctx).Error("failed to validate refresh token", zap.Error(err))
		return nil, errs.Internal("failed to validate refresh token")
	}
	if rec.RevokedAt.Valid || time.Now().After(rec.ExpiresAt) {
		logger.FromContext(ctx).Warn("refresh token revoked or expired",
			zap.Bool("revoked", rec.RevokedAt.Valid),
			zap.Time("expiresAt", rec.ExpiresAt),
			zap.Time("now", time.Now()))
		return nil, errs.Unauthorized("refresh token is revoked or expired")
	}

	var newAccess, newRefresh string
	var refreshExp time.Time
	err = h.tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		if err := h.repo.RevokeRefreshToken(ctxTx, tokenHash); err != nil {
			return err
		}

		var genErr error
		newAccess, _, genErr = h.tokenSvc.GenerateAccessToken(rec.UserID, claims.Username, claims.Role)
		if genErr != nil {
			return genErr
		}
		newRefresh, refreshExp, genErr = h.tokenSvc.GenerateRefreshToken(rec.UserID, claims.Username, claims.Role)
		if genErr != nil {
			return genErr
		}

		if err := h.repo.InsertRefreshToken(ctxTx, service.HashRefreshToken(newRefresh), rec.UserID, refreshExp); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		logger.FromContext(ctx).Error("failed to refresh token", zap.Error(err))
		return nil, errs.Internal("failed to refresh token")
	}

	return &Response{
		AccessToken:  newAccess,
		RefreshToken: newRefresh,
		ExpiresIn:    int64(h.tokenSvc.AccessTTL().Seconds()),
	}, nil
}
