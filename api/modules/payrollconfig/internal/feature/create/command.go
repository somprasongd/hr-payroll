package create

import (
	"context"

	"github.com/google/uuid"

	"hrms/modules/payrollconfig/internal/dto"
	"hrms/modules/payrollconfig/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
)

type Command struct {
	Payload RequestBody
	ActorID uuid.UUID
}

type Response struct {
	dto.Config
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

	recPayload := cmd.Payload.ToRecord()

	var created *repository.Record
	err := h.tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		created, err = h.repo.Create(ctxTx, recPayload, cmd.ActorID)
		return err
	})
	if err != nil {
		return nil, errs.Internal("failed to create payroll config")
	}

	return &Response{Config: dto.FromRecord(*created)}, nil
}

func validatePayload(p RequestBody) error {
	if p.ParsedStartDate.IsZero() {
		return errs.BadRequest("startDate is required (YYYY-MM-DD)")
	}
	if p.HourlyRate <= 0 || p.OtHourlyRate <= 0 {
		return errs.BadRequest("hourlyRate and otHourlyRate must be positive")
	}
	if p.SocialSecurityRateEmployee < 0 || p.SocialSecurityRateEmployer < 0 {
		return errs.BadRequest("social security rates must be positive")
	}
	return nil
}
