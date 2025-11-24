package update

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/lib/pq"

	"hrms/modules/employee/internal/dto"
	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
)

type Command struct {
	ID      uuid.UUID
	Payload RequestBody
	ActorID uuid.UUID
}

type Response struct {
	dto.Detail
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

	recPayload := cmd.Payload.ToDetailRecord()

	var updated *repository.DetailRecord
	err := h.tx.WithinTransaction(ctx, func(ctxWithTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		updated, err = h.repo.Update(ctxWithTx, cmd.ID, recPayload, cmd.ActorID)
		return err
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("employee not found")
		}
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return nil, errs.Conflict("employeeNumber already exists for active employee")
		}
		return nil, errs.Internal("failed to update employee")
	}

	return &Response{Detail: dto.FromDetailRecord(*updated)}, nil
}

func validatePayload(p RequestBody) error {
	if strings.TrimSpace(p.EmployeeNumber) == "" ||
		p.TitleID == uuid.Nil ||
		strings.TrimSpace(p.FirstName) == "" ||
		strings.TrimSpace(p.LastName) == "" ||
		p.IDDocumentTypeID == uuid.Nil ||
		strings.TrimSpace(p.IDDocumentNumber) == "" ||
		p.EmployeeTypeID == uuid.Nil ||
		p.BasePayAmount <= 0 ||
		p.EmploymentStartDate.IsZero() {
		return errs.BadRequest("missing required fields")
	}
	return nil
}
