package publiclogo

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

type Response struct {
	ContentType   string
	FileSizeBytes int64
	ChecksumMD5   string
	Data          []byte
}

type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*Query, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, _ *Query) (*Response, error) {
	// Get effective org profile to find logo ID
	rec, err := h.repo.GetEffective(ctx, time.Now())
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			logger.FromContext(ctx).Warn("no effective org profile for public logo", zap.Error(err))
			return nil, errs.NotFound("branding not configured")
		}
		logger.FromContext(ctx).Error("failed to get effective org profile for public logo", zap.Error(err))
		return nil, errs.Internal("failed to get branding")
	}

	if rec.LogoID == nil {
		return nil, errs.NotFound("logo not configured")
	}

	// Get logo data
	logo, err := h.repo.GetLogo(ctx, *rec.LogoID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			logger.FromContext(ctx).Warn("logo not found", zap.String("logoId", rec.LogoID.String()))
			return nil, errs.NotFound("logo not found")
		}
		logger.FromContext(ctx).Error("failed to get logo", zap.Error(err))
		return nil, errs.Internal("failed to get logo")
	}

	return &Response{
		ContentType:   logo.ContentType,
		FileSizeBytes: logo.FileSizeBytes,
		ChecksumMD5:   logo.ChecksumMD5,
		Data:          logo.Data,
	}, nil
}
