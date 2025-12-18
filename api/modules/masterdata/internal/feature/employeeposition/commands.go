package employeeposition

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
	Code      string `json:"code"`
	Name      string `json:"name"`
	CompanyID uuid.UUID
	ActorID   uuid.UUID
}

type UpdateCommand struct {
	ID        uuid.UUID
	Code      string `json:"code"`
	Name      string `json:"name"`
	CompanyID uuid.UUID
	ActorID   uuid.UUID
}

type DeleteCommand struct {
	ID        uuid.UUID
	CompanyID uuid.UUID
	ActorID   uuid.UUID
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
	cmd.CompanyID = tenant.CompanyID

	code := strings.TrimSpace(cmd.Code)
	name := strings.TrimSpace(cmd.Name)
	if code == "" || name == "" {
		return nil, errs.BadRequest("code and name are required")
	}

	rec, err := h.repo.CreateEmployeePosition(ctx, code, name, cmd.CompanyID, cmd.ActorID)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, errs.Conflict("code already exists")
		}
		logger.FromContext(ctx).Error("failed to create employee position", zap.Error(err))
		return nil, errs.Internal("failed to create employee position")
	}
	h.eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		CompanyID:  &cmd.CompanyID,
		Action:     "CREATE",
		EntityName: "EMPLOYEE_POSITION",
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
	cmd.CompanyID = tenant.CompanyID

	code := strings.TrimSpace(cmd.Code)
	name := strings.TrimSpace(cmd.Name)
	if code == "" || name == "" {
		return nil, errs.BadRequest("code and name are required")
	}

	rec, err := h.repo.UpdateEmployeePosition(ctx, cmd.ID, code, name, cmd.CompanyID, cmd.ActorID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errs.NotFound("employee position not found")
		}
		if isUniqueViolation(err) {
			return nil, errs.Conflict("code already exists")
		}
		logger.FromContext(ctx).Error("failed to update employee position", zap.Error(err), zap.String("id", cmd.ID.String()))
		return nil, errs.Internal("failed to update employee position")
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		CompanyID:  &cmd.CompanyID,
		Action:     "UPDATE",
		EntityName: "EMPLOYEE_POSITION",
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
	cmd.CompanyID = tenant.CompanyID

	if err := h.repo.SoftDeleteEmployeePosition(ctx, cmd.ID, cmd.CompanyID, cmd.ActorID); err != nil {
		if err == sql.ErrNoRows {
			return mediator.NoResponse{}, errs.NotFound("employee position not found")
		}
		logger.FromContext(ctx).Error("failed to delete employee position", zap.Error(err), zap.String("id", cmd.ID.String()))
		return mediator.NoResponse{}, errs.Internal("failed to delete employee position")
	}
	h.eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		CompanyID:  &cmd.CompanyID,
		Action:     "DELETE",
		EntityName: "EMPLOYEE_POSITION",
		EntityID:   cmd.ID.String(),
		Timestamp:  time.Now(),
	})
	return mediator.NoResponse{}, nil
}

func isUniqueViolation(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "23505"
}
