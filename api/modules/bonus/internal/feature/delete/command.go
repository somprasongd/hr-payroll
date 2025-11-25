package delete

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/bonus/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
)

type Command struct {
	ID    uuid.UUID
	Actor uuid.UUID
	Repo  repository.Repository
}

type Handler struct{}

func NewHandler() *Handler { return &Handler{} }

var _ mediator.RequestHandler[*Command, mediator.NoResponse] = (*Handler)(nil)

func (h *Handler) Handle(ctx context.Context, cmd *Command) (mediator.NoResponse, error) {
	cycle, _, err := cmd.Repo.Get(ctx, cmd.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("bonus cycle not found")
		}
		logger.FromContext(ctx).Error("failed to load bonus cycle", zap.Error(err))
		return mediator.NoResponse{}, errs.Internal("failed to load bonus cycle")
	}
	if cycle.Status == "approved" {
		return mediator.NoResponse{}, errs.BadRequest("cannot delete approved cycle")
	}
	if err := cmd.Repo.DeleteCycle(ctx, cmd.ID, cmd.Actor); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("bonus cycle not found")
		}
		logger.FromContext(ctx).Error("failed to delete bonus cycle", zap.Error(err))
		return mediator.NoResponse{}, errs.Internal("failed to delete bonus cycle")
	}
	return mediator.NoResponse{}, nil
}
