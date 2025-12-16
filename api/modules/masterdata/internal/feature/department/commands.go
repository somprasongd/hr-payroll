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
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/events"
)

type CreateCommand struct {
	Code    string `json:"code"`
	Name    string `json:"name"`
	ActorID uuid.UUID
}

type UpdateCommand struct {
	ID      uuid.UUID
	Code    string `json:"code"`
	Name    string `json:"name"`
	ActorID uuid.UUID
}

type DeleteCommand struct {
	ID      uuid.UUID
	ActorID uuid.UUID
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
	code := strings.TrimSpace(cmd.Code)
	name := strings.TrimSpace(cmd.Name)
	if code == "" || name == "" {
		return nil, errs.BadRequest("code and name are required")
	}

	rec, err := h.repo.CreateDepartment(ctx, code, name, cmd.ActorID)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, errs.Conflict("code already exists")
		}
		logger.FromContext(ctx).Error("failed to create department", zap.Error(err))
		return nil, errs.Internal("failed to create department")
	}
	return &Response{Record: *rec}, nil
}

func (h *UpdateHandler) Handle(ctx context.Context, cmd *UpdateCommand) (*Response, error) {
	code := strings.TrimSpace(cmd.Code)
	name := strings.TrimSpace(cmd.Name)
	if code == "" || name == "" {
		return nil, errs.BadRequest("code and name are required")
	}

	rec, err := h.repo.UpdateDepartment(ctx, cmd.ID, code, name, cmd.ActorID)
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
	return &Response{Record: *rec}, nil
}

func (h *DeleteHandler) Handle(ctx context.Context, cmd *DeleteCommand) (mediator.NoResponse, error) {
	if err := h.repo.SoftDeleteDepartment(ctx, cmd.ID, cmd.ActorID); err != nil {
		if err == sql.ErrNoRows {
			return mediator.NoResponse{}, errs.NotFound("department not found")
		}
		logger.FromContext(ctx).Error("failed to delete department", zap.Error(err), zap.String("id", cmd.ID.String()))
		return mediator.NoResponse{}, errs.Internal("failed to delete department")
	}
	h.eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		Action:     "DELETE",
		EntityName: "DEPARTMENT",
		EntityID:   cmd.ID.String(),
		Details: map[string]interface{}{
			"deleted_dept_id": cmd.ID.String(),
		},
		Timestamp: time.Now(),
	})
	return mediator.NoResponse{}, nil
}

func isUniqueViolation(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "23505"
}
