package employeeposition

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"go.uber.org/zap"

	"hrms/modules/masterdata/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
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
}

type UpdateHandler struct {
	repo repository.Repository
}

type DeleteHandler struct {
	repo repository.Repository
}

var (
	_ mediator.RequestHandler[*CreateCommand, *Response]           = (*CreateHandler)(nil)
	_ mediator.RequestHandler[*UpdateCommand, *Response]           = (*UpdateHandler)(nil)
	_ mediator.RequestHandler[*DeleteCommand, mediator.NoResponse] = (*DeleteHandler)(nil)
)

func NewCreateHandler(repo repository.Repository) *CreateHandler {
	return &CreateHandler{repo: repo}
}

func NewUpdateHandler(repo repository.Repository) *UpdateHandler {
	return &UpdateHandler{repo: repo}
}

func NewDeleteHandler(repo repository.Repository) *DeleteHandler {
	return &DeleteHandler{repo: repo}
}

func (h *CreateHandler) Handle(ctx context.Context, cmd *CreateCommand) (*Response, error) {
	code := strings.TrimSpace(cmd.Code)
	name := strings.TrimSpace(cmd.Name)
	if code == "" || name == "" {
		return nil, errs.BadRequest("code and name are required")
	}

	rec, err := h.repo.CreateEmployeePosition(ctx, code, name, cmd.ActorID)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, errs.Conflict("code already exists")
		}
		logger.FromContext(ctx).Error("failed to create employee position", zap.Error(err))
		return nil, errs.Internal("failed to create employee position")
	}
	return &Response{Record: *rec}, nil
}

func (h *UpdateHandler) Handle(ctx context.Context, cmd *UpdateCommand) (*Response, error) {
	code := strings.TrimSpace(cmd.Code)
	name := strings.TrimSpace(cmd.Name)
	if code == "" || name == "" {
		return nil, errs.BadRequest("code and name are required")
	}

	rec, err := h.repo.UpdateEmployeePosition(ctx, cmd.ID, code, name, cmd.ActorID)
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
	return &Response{Record: *rec}, nil
}

func (h *DeleteHandler) Handle(ctx context.Context, cmd *DeleteCommand) (mediator.NoResponse, error) {
	if err := h.repo.SoftDeleteEmployeePosition(ctx, cmd.ID, cmd.ActorID); err != nil {
		if err == sql.ErrNoRows {
			return mediator.NoResponse{}, errs.NotFound("employee position not found")
		}
		logger.FromContext(ctx).Error("failed to delete employee position", zap.Error(err), zap.String("id", cmd.ID.String()))
		return mediator.NoResponse{}, errs.Internal("failed to delete employee position")
	}
	return mediator.NoResponse{}, nil
}

func isUniqueViolation(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "23505"
}
