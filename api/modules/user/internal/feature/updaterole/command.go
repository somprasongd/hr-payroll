package updaterole

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/user/internal/dto"
	"hrms/modules/user/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/validator"
	"hrms/shared/events"
)

type Command struct {
	ID    uuid.UUID `validate:"required"`
	Role  string    `validate:"required,oneof=admin hr timekeeper"`
	Actor uuid.UUID `validate:"required"`
}

type Response struct {
	dto.User
}

type Handler struct {
	repo repository.Repository
	eb   eventbus.EventBus
}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository, eb eventbus.EventBus) *Handler {
	return &Handler{repo: repo, eb: eb}
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	if err := validator.Validate(cmd); err != nil {
		return nil, err
	}

	if err := h.repo.UpdateRole(ctx, cmd.ID, cmd.Role, cmd.Actor); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("user not found")
		}
		logger.FromContext(ctx).Error("failed to update user role", zap.Error(err))
		return nil, errs.Internal("failed to update role")
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
		Action:     "UPDATE",
		EntityName: "USER",
		EntityID:   cmd.ID.String(),
		Details:    map[string]interface{}{"role": cmd.Role},
		Timestamp:  time.Now(),
	})

	user, err := h.repo.GetUser(ctx, cmd.ID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to fetch updated user", zap.Error(err))
		return nil, errs.Internal("failed to fetch updated user")
	}
	return &Response{User: dto.FromRecord(*user)}, nil
}
