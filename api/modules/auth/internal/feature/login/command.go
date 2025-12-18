package login

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/google/uuid"

	"hrms/modules/auth/internal/repository"
	"hrms/modules/auth/internal/service"
	"hrms/shared/common/errs"
	"hrms/shared/common/jwt"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/password"
	"hrms/shared/common/storage/sqldb/transactor"

	"go.uber.org/zap"
)

type Command struct {
	Username  string
	Password  string
	IP        string
	UserAgent string
}

type Response struct {
	AccessToken  string                   `json:"accessToken"`
	RefreshToken string                   `json:"refreshToken"`
	TokenType    string                   `json:"tokenType"`
	ExpiresIn    int64                    `json:"expiresIn"`
	User         userPayload              `json:"user"`
	Companies    []repository.CompanyInfo `json:"companies,omitempty"`
	Branches     []repository.BranchInfo  `json:"branches,omitempty"`
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
		logger.FromContext(ctx).Error("failed to query user", zap.Error(err))
		return nil, errs.Internal("failed to query user")
	}

	ok, err := password.Verify(cmd.Password, user.PasswordHash)
	if err != nil {
		logger.FromContext(ctx).Error("failed to verify password", zap.Error(err))
		return nil, errs.Internal("failed to verify password")
	}
	if !ok {
		h.repo.LogAccess(ctx, user.ID, "failed_password", cmd.IP, cmd.UserAgent)
		return nil, errs.Unauthorized("invalid credentials")
	}

	accessToken, _, err := h.tokenSvc.GenerateAccessToken(user.ID, user.Username, user.Role)
	if err != nil {
		logger.FromContext(ctx).Error("failed to generate access token", zap.Error(err))
		return nil, errs.Internal("failed to generate access token")
	}
	refreshToken, refreshExp, err := h.tokenSvc.GenerateRefreshToken(user.ID, user.Username, user.Role)
	if err != nil {
		logger.FromContext(ctx).Error("failed to generate refresh token", zap.Error(err))
		return nil, errs.Internal("failed to generate refresh token")
	}

	if err := h.tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		if err := h.repo.InsertRefreshToken(ctxTx, service.HashRefreshToken(refreshToken), user.ID, refreshExp); err != nil {
			return err
		}
		h.repo.LogAccess(ctxTx, user.ID, "success", cmd.IP, cmd.UserAgent)
		return nil
	}); err != nil {
		logger.FromContext(ctx).Error("failed to persist session", zap.Error(err))
		return nil, errs.Internal("failed to persist session")
	}

	// Fetch user's companies and branches
	companies, err := h.repo.GetUserCompanies(ctx, user.ID)
	if err != nil {
		logger.FromContext(ctx).Warn("failed to get user companies", zap.Error(err))
		companies = nil // Don't fail login, just skip companies
	}

	var branches []repository.BranchInfo
	if len(companies) > 0 {
		branches, err = h.repo.GetAllUserBranches(ctx, user.ID)
		if err != nil {
			logger.FromContext(ctx).Warn("failed to get user branches", zap.Error(err))
			branches = nil
		}
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
		Companies: companies,
		Branches:  branches,
	}, nil
}
