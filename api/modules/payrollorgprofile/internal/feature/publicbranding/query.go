package publicbranding

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"go.uber.org/zap"

	"hrms/modules/payrollorgprofile/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
)

type Query struct{}

type BrandingResponse struct {
	CompanyName string  `json:"companyName"`
	LogoURL     *string `json:"logoUrl"`
}

type Response struct {
	Branding BrandingResponse `json:"branding"`
}

type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*Query, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, _ *Query) (*Response, error) {
	rec, err := h.repo.GetEffective(ctx, time.Now())
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			logger.FromContext(ctx).Warn("no effective org profile for public branding", zap.Error(err))
			return nil, errs.NotFound("branding not configured")
		}
		logger.FromContext(ctx).Error("failed to get effective org profile for public branding", zap.Error(err))
		return nil, errs.Internal("failed to get branding")
	}

	branding := BrandingResponse{
		CompanyName: rec.CompanyName,
	}

	// If logo exists, provide the public logo URL
	if rec.LogoID != nil {
		url := "/api/v1/public/branding/logo"
		branding.LogoURL = &url
	}

	return &Response{Branding: branding}, nil
}
