package delete

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/events"
)

type Command struct {
	EmployeeID uuid.UUID
	ActorID    uuid.UUID
	CompanyID  uuid.UUID
	BranchID   uuid.UUID
}

type Handler struct {
	repo repository.Repository
	tx   transactor.Transactor
	eb   eventbus.EventBus
}

var _ mediator.RequestHandler[*Command, mediator.NoResponse] = (*Handler)(nil)

func NewHandler(repo repository.Repository, tx transactor.Transactor, eb eventbus.EventBus) *Handler {
	return &Handler{repo: repo, tx: tx, eb: eb}
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (mediator.NoResponse, error) {
	var prevPhotoID *uuid.UUID
	err := h.tx.WithinTransaction(ctx, func(ctxWithTx context.Context, hook func(transactor.PostCommitHook)) error {
		var err error
		prevPhotoID, err = h.repo.ClearEmployeePhoto(ctxWithTx, cmd.EmployeeID, cmd.ActorID)
		if err != nil {
			return err
		}

		if prevPhotoID != nil {
			if err := h.repo.DeletePhoto(ctxWithTx, *prevPhotoID); err != nil && !errors.Is(err, sql.ErrNoRows) {
				return err
			}
		}

		if prevPhotoID != nil {
			hook(func(ctx context.Context) error {
				h.eb.Publish(events.LogEvent{
					ActorID:    cmd.ActorID,
					CompanyID:  &cmd.CompanyID,
					BranchID:   &cmd.BranchID,
					Action:     "DELETE",
					EntityName: "EMPLOYEE_PHOTO",
					EntityID:   prevPhotoID.String(),
					Details: map[string]interface{}{
						"employee_id": cmd.EmployeeID.String(),
					},
					Timestamp: time.Now(),
				})
				return nil
			})
		}

		return nil
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("employee not found")
		}
		logger.FromContext(ctx).Error("failed to delete employee photo", zap.Error(err))
		return mediator.NoResponse{}, errs.Internal("failed to delete employee photo")
	}

	return mediator.NoResponse{}, nil
}
