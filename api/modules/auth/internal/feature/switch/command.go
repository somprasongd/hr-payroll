package switch_tenant

import (
	"context"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/auth/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/jwt"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
)

type Command struct {
	UserID    uuid.UUID
	Username  string
	Role      string
	CompanyID uuid.UUID
	BranchIDs []uuid.UUID
}

type Response struct {
	AccessToken  string                  `json:"accessToken"`
	RefreshToken string                  `json:"refreshToken"`
	TokenType    string                  `json:"tokenType"`
	ExpiresIn    int64                   `json:"expiresIn"`
	Company      *repository.CompanyInfo `json:"company"`
	Branches     []repository.BranchInfo `json:"branches"`
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
	// Validate company access
	if !h.repo.HasCompanyAccess(ctx, cmd.UserID, cmd.CompanyID) {
		return nil, errs.Forbidden("access denied to this company")
	}

	// Get company info
	company, err := h.repo.GetCompanyByID(ctx, cmd.CompanyID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get company", zap.Error(err))
		return nil, errs.Internal("failed to get company")
	}

	// Get user role in company
	role, err := h.repo.GetUserCompanyRole(ctx, cmd.UserID, cmd.CompanyID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to get user role", zap.Error(err))
		return nil, errs.Internal("failed to get user role")
	}
	company.Role = role

	// Get branches for this company
	var branches []repository.BranchInfo
	if role == "admin" {
		// Admin sees all branches
		branches, err = h.repo.GetAllBranches(ctx, cmd.CompanyID)
	} else {
		// Non-admin sees only assigned branches
		branches, err = h.repo.GetUserBranches(ctx, cmd.UserID, cmd.CompanyID)
	}
	if err != nil {
		logger.FromContext(ctx).Error("failed to get branches", zap.Error(err))
		return nil, errs.Internal("failed to get branches")
	}

	// If specific branches requested, filter
	if len(cmd.BranchIDs) > 0 {
		allowed := make(map[uuid.UUID]bool)
		for _, b := range branches {
			allowed[b.ID] = true
		}
		filtered := make([]repository.BranchInfo, 0)
		for _, reqID := range cmd.BranchIDs {
			if allowed[reqID] {
				for _, b := range branches {
					if b.ID == reqID {
						filtered = append(filtered, b)
						break
					}
				}
			}
		}
		if len(filtered) == 0 {
			return nil, errs.Forbidden("no access to requested branches")
		}
		branches = filtered
	}

	// Generate new tokens with tenant info embedded in claims
	accessToken, _, err := h.tokenSvc.GenerateAccessToken(cmd.UserID, cmd.Username, cmd.Role)
	if err != nil {
		logger.FromContext(ctx).Error("failed to generate access token", zap.Error(err))
		return nil, errs.Internal("failed to generate access token")
	}

	refreshToken, _, err := h.tokenSvc.GenerateRefreshToken(cmd.UserID, cmd.Username, cmd.Role)
	if err != nil {
		logger.FromContext(ctx).Error("failed to generate refresh token", zap.Error(err))
		return nil, errs.Internal("failed to generate refresh token")
	}

	return &Response{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    int64(h.tokenSvc.AccessTTL().Seconds()),
		Company:      company,
		Branches:     branches,
	}, nil
}
