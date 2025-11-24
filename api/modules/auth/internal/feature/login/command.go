package login

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/google/uuid"

	"go.uber.org/zap"
	"hrms/modules/auth/internal/repository"
	"hrms/modules/auth/internal/service"
	"hrms/shared/common/errs"
	"hrms/shared/common/jwt"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/password"
	"hrms/shared/common/storage/sqldb/transactor"
)

type Command struct {
	Username  string
	Password  string
	IP        string
	UserAgent string
}

type Response struct {
	AccessToken  string      `json:"accessToken"`
	RefreshToken string      `json:"refreshToken"`
	TokenType    string      `json:"tokenType"`
	ExpiresIn    int64       `json:"expiresIn"`
	User         userPayload `json:"user"`
}

type userPayload struct {
	ID       uuid.UUID `json:"id"`
	Username string    `json:"username"`
	Role     string    `json:"role"`
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
	cmd.Username = strings.TrimSpace(cmd.Username)
	if cmd.Username == "" || cmd.Password == "" {
		return nil, errs.BadRequest("username and password are required")
	}

	user, err := h.repo.FindUserByUsername(ctx, cmd.Username)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.Unauthorized("invalid credentials")
		}
		return nil, errs.Internal("failed to query user")
	}

	ok, err := password.Verify(cmd.Password, user.PasswordHash)
	if err != nil {
		return nil, errs.Internal("failed to verify password")
	}
	if !ok {
		h.repo.LogAccess(ctx, user.ID, "failed_password", cmd.IP, cmd.UserAgent)
		return nil, errs.Unauthorized("invalid credentials")
	}

	accessToken, _, err := h.tokenSvc.GenerateAccessToken(user.ID, user.Username, user.Role)
	if err != nil {
		return nil, errs.Internal("failed to generate access token")
	}
	refreshToken, refreshExp, err := h.tokenSvc.GenerateRefreshToken(user.ID, user.Username, user.Role)
	if err != nil {
		return nil, errs.Internal("failed to generate refresh token")
	}

	if err := h.tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		if err := h.repo.InsertRefreshToken(ctxTx, service.HashRefreshToken(refreshToken), user.ID, refreshExp); err != nil {
			return err
		}
		h.repo.LogAccess(ctxTx, user.ID, "success", cmd.IP, cmd.UserAgent)
		return nil
	}); err != nil {
		logger.Log().Error("failed to persist session", zap.Error(err))
		return nil, errs.Internal("failed to persist session")
	}

	return &Response{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    int64(h.tokenSvc.AccessTTL().Seconds()),
		User: userPayload{
			ID:       user.ID,
			Username: user.Username,
			Role:     user.Role,
		},
	}, nil
}
