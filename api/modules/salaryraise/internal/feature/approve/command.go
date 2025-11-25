package approve

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/salaryraise/internal/dto"
	"hrms/modules/salaryraise/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
)

type Command struct {
	ID     uuid.UUID
	Status string
	Actor  uuid.UUID
	Repo   repository.Repository
	Tx     transactor.Transactor
}

type Response struct {
	dto.Cycle
	Message string `json:"message"`
}

type Handler struct{}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler() *Handler { return &Handler{} }

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	cmd.Status = strings.TrimSpace(cmd.Status)
	if cmd.Status != "approved" && cmd.Status != "rejected" {
		return nil, errs.BadRequest("status must be approved or rejected")
	}

	updated, err := cmd.Repo.UpdateStatus(ctx, cmd.ID, cmd.Status, cmd.Actor)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			logger.FromContext(ctx).Warn("salary raise cycle not found or cannot change status", zap.Error(err), zap.String("status", cmd.Status))
			return nil, errs.NotFound("cycle not found or cannot change status")
		}
		logger.FromContext(ctx).Error("failed to update salary raise status", zap.Error(err), zap.String("status", cmd.Status))
		return nil, errs.Internal("failed to update cycle status")
	}
	msg := "Cycle status updated."
	return &Response{Cycle: dto.FromCycle(*updated), Message: msg}, nil
}
