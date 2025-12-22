package department

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"go.uber.org/zap"

	"hrms/modules/masterdata/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/events"
)

type CreateCommand struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

type UpdateCommand struct {
	ID   uuid.UUID
	Code string `json:"code"`
	Name string `json:"name"`
}

type DeleteCommand struct {
	ID uuid.UUID
}

type Response struct {
	Record repository.MasterRecord `json:"record"`
}

type CreateHandler struct {
	repo repository.Repository
	eb   eventbus.EventBus
}

type UpdateHandler struct {
	repo repository.Repository
	eb   eventbus.EventBus
}

type DeleteHandler struct {
	repo repository.Repository
	eb   eventbus.EventBus
}

var (
	_ mediator.RequestHandler[*CreateCommand, *Response]           = (*CreateHandler)(nil)
	_ mediator.RequestHandler[*UpdateCommand, *Response]           = (*UpdateHandler)(nil)
	_ mediator.RequestHandler[*DeleteCommand, mediator.NoResponse] = (*DeleteHandler)(nil)
)

func NewCreateHandler(repo repository.Repository, eb eventbus.EventBus) *CreateHandler {
	return &CreateHandler{repo: repo, eb: eb}
}

func NewUpdateHandler(repo repository.Repository, eb eventbus.EventBus) *UpdateHandler {
	return &UpdateHandler{repo: repo, eb: eb}
}

func NewDeleteHandler(repo repository.Repository, eb eventbus.EventBus) *DeleteHandler {
	return &DeleteHandler{repo: repo, eb: eb}
}

func (h *CreateHandler) Handle(ctx context.Context, cmd *CreateCommand) (*Response, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing user context")
	}

	code := strings.TrimSpace(cmd.Code)
	name := strings.TrimSpace(cmd.Name)
	if code == "" || name == "" {
		return nil, errs.BadRequest("code and name are required")
	}

	rec, err := h.repo.CreateDepartment(ctx, code, name, tenant.CompanyID, user.ID)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, errs.Conflict("code already exists")
		}
		logger.FromContext(ctx).Error("failed to create department", zap.Error(err))
		return nil, errs.Internal("failed to create department")
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  &tenant.CompanyID,
		Action:     "CREATE",
		EntityName: "DEPARTMENT",
		EntityID:   rec.ID.String(),
		Details: map[string]interface{}{
			"code": rec.Code,
			"name": rec.Name,
		},
		Timestamp: time.Now(),
	})

	return &Response{Record: *rec}, nil
}

func (h *UpdateHandler) Handle(ctx context.Context, cmd *UpdateCommand) (*Response, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing user context")
	}

	code := strings.TrimSpace(cmd.Code)
	name := strings.TrimSpace(cmd.Name)
	if code == "" || name == "" {
		return nil, errs.BadRequest("code and name are required")
	}

	rec, err := h.repo.UpdateDepartment(ctx, cmd.ID, code, name, tenant.CompanyID, user.ID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errs.NotFound("department not found")
		}
		if isUniqueViolation(err) {
			return nil, errs.Conflict("code already exists")
		}
		logger.FromContext(ctx).Error("failed to update department", zap.Error(err), zap.String("id", cmd.ID.String()))
		return nil, errs.Internal("failed to update department")
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  &tenant.CompanyID,
		Action:     "UPDATE",
		EntityName: "DEPARTMENT",
		EntityID:   rec.ID.String(),
		Details: map[string]interface{}{
			"code": rec.Code,
			"name": rec.Name,
		},
		Timestamp: time.Now(),
	})

	return &Response{Record: *rec}, nil
}

func (h *DeleteHandler) Handle(ctx context.Context, cmd *DeleteCommand) (mediator.NoResponse, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return mediator.NoResponse{}, errs.Unauthorized("missing tenant context")
	}

	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return mediator.NoResponse{}, errs.Unauthorized("missing user context")
	}

	if err := h.repo.SoftDeleteDepartment(ctx, cmd.ID, tenant.CompanyID, user.ID); err != nil {
		if err == sql.ErrNoRows {
			return mediator.NoResponse{}, errs.NotFound("department not found")
		}
		logger.FromContext(ctx).Error("failed to delete department", zap.Error(err), zap.String("id", cmd.ID.String()))
		return mediator.NoResponse{}, errs.Internal("failed to delete department")
	}
	h.eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  &tenant.CompanyID,
		Action:     "DELETE",
		EntityName: "DEPARTMENT",
		EntityID:   cmd.ID.String(),
		Timestamp:  time.Now(),
	})
	return mediator.NoResponse{}, nil
}

func isUniqueViolation(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "23505"
}
