package create

import (
	"context"
	"strings"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/payrollorgprofile/internal/dto"
	"hrms/modules/payrollorgprofile/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
)

type Command struct {
	Payload RequestBody
	ActorID uuid.UUID
}

type Response struct {
	dto.Profile
}

type Handler struct {
	repo repository.Repository
	tx   transactor.Transactor
}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository, tx transactor.Transactor) *Handler {
	return &Handler{
		repo: repo,
		tx:   tx,
	}
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	if err := validatePayload(cmd.Payload); err != nil {
		return nil, err
	}

	payload := cmd.Payload.ToPayload()
	// ensure explicit active when status not provided
	if payload.Status == nil || strings.TrimSpace(*payload.Status) == "" {
		active := "active"
		payload.Status = &active
	}

	var created *repository.Record
	err := h.tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		created, err = h.repo.Create(ctxTx, payload, cmd.ActorID)
		return err
	})
	if err != nil {
		logger.FromContext(ctx).Error("failed to create org profile", zap.Error(err))
		return nil, errs.Internal("failed to create org profile")
	}

	return &Response{Profile: dto.FromRecord(*created)}, nil
}
