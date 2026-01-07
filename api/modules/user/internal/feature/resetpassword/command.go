package resetpassword

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/user/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/password"
	"hrms/shared/common/validator"
	"hrms/shared/events"
)

type Command struct {
	ID          uuid.UUID `validate:"required"`
	NewPassword string    `validate:"required"`
	Actor       uuid.UUID `validate:"required"`
}

type Response struct {
	Message string `json:"message"`
}

type Handler struct {
	repo repository.Repository
	eb   eventbus.EventBus
}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository, eb eventbus.EventBus) *Handler {
	return &Handler{
		repo: repo,
		eb:   eb,
	}
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	cmd.NewPassword = strings.TrimSpace(cmd.NewPassword)
	if err := validator.Validate(cmd); err != nil {
		return nil, err
	}

	hash, err := password.Hash(cmd.NewPassword)
	if err != nil {
		logger.FromContext(ctx).Error("failed to hash new password", zap.Error(err))
		return nil, errs.Internal("failed to hash password")
	}

	if err := h.repo.ResetPassword(ctx, cmd.ID, hash, cmd.Actor); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("user not found")
		}
		logger.FromContext(ctx).Error("failed to reset password", zap.Error(err))
		return nil, errs.Internal("failed to reset password")
	}

	// Get company ID from tenant context (nil if superadmin)
	var companyID *uuid.UUID
	if tenant, ok := contextx.TenantFromContext(ctx); ok {
		companyID = &tenant.CompanyID
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    cmd.Actor,
		CompanyID:  companyID,
		BranchID:   nil,
		Action:     "RESET_PASSWORD",
		EntityName: "USER",
		EntityID:   cmd.ID.String(),
		Timestamp:  time.Now(),
	})

	return &Response{Message: "Password has been reset successfully."}, nil
}
