package approve

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/bonus/internal/dto"
	"hrms/modules/bonus/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/events"
)

type Command struct {
	ID     uuid.UUID
	Status string
	Repo   repository.Repository
	Tx     transactor.Transactor
	Eb     eventbus.EventBus
}

type Response struct {
	dto.Cycle
	Message string `json:"message"`
}

type Handler struct{}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler() *Handler { return &Handler{} }

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing user context")
	}

	cmd.Status = strings.TrimSpace(cmd.Status)
	if cmd.Status != "approved" && cmd.Status != "rejected" {
		return nil, errs.BadRequest("status must be approved or rejected")
	}
	if user.Role == "hr" {
		return nil, errs.Forbidden("HR is not allowed to change status")
	}

	updated, err := cmd.Repo.UpdateStatus(ctx, tenant, cmd.ID, cmd.Status, user.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			logger.FromContext(ctx).Warn("bonus cycle not found or status cannot change", zap.Error(err), zap.String("status", cmd.Status))
			return nil, errs.NotFound("cycle not found or cannot change status")
		}
		logger.FromContext(ctx).Error("failed to update bonus cycle status", zap.Error(err), zap.String("status", cmd.Status))
		return nil, errs.Internal("failed to update status")
	}
	cmd.Eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  &tenant.CompanyID,
		BranchID:   tenant.BranchIDPtr(),
		Action:     "UPDATE_STATUS",
		EntityName: "BONUS_CYCLE",
		EntityID:   cmd.ID.String(),
		Details: map[string]interface{}{
			"status": cmd.Status,
		},
		Timestamp: time.Now(),
	})

	return &Response{
		Cycle:   dto.FromCycle(*updated),
		Message: "Bonus cycle status updated.",
	}, nil
}
