package create

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"go.uber.org/zap"

	"hrms/modules/employee/internal/dto"
	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/events"
)

type Command struct {
	Payload RequestBody
	ActorID uuid.UUID
}

type Response struct {
	dto.Detail
}

type Handler struct {
	repo repository.Repository
	tx   transactor.Transactor
	eb   eventbus.EventBus
}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository, tx transactor.Transactor, eb eventbus.EventBus) *Handler {
	return &Handler{
		repo: repo,
		tx:   tx,
		eb:   eb,
	}
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	if err := validatePayload(cmd.Payload); err != nil {
		return nil, err
	}

	recPayload := cmd.Payload.ToDetailRecord()

	var created *repository.DetailRecord
	err := h.tx.WithinTransaction(ctx, func(ctxWithTx context.Context, hook func(transactor.PostCommitHook)) error {
		var err error
		created, err = h.repo.Create(ctxWithTx, recPayload, cmd.ActorID)
		if err != nil {
			return err
		}

		hook(func(ctx context.Context) error {
			h.eb.Publish(events.LogEvent{
				ActorID:    cmd.ActorID,
				Action:     "CREATE",
				EntityName: "EMPLOYEE",
				EntityID:   created.ID.String(),
				Details: map[string]interface{}{
					"code":                    created.EmployeeNumber,
					"firstName":               created.FirstName,
					"lastName":                created.LastName,
					"idDocumentNumber":        created.IDDocumentNumber,
					"phone":                   created.Phone,
					"email":                   created.Email,
					"employeeTypeId":          created.EmployeeTypeID,
					"departmentId":            created.DepartmentID,
					"positionId":              created.PositionID,
					"basePayAmount":           created.BasePayAmount,
					"employmentStartDate":     created.EmploymentStartDate,
					"ssoContribute":           created.SSOContribute,
					"providentFundContribute": created.ProvidentFundContribute,
					"status":                  created.Status,
				},
				Timestamp: created.CreatedAt,
			})
			return nil
		})

		return nil
	})
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			logger.FromContext(ctx).Warn("duplicate employee number", zap.Error(err))
			return nil, errs.Conflict("employeeNumber already exists for active employee")
		}
		logger.FromContext(ctx).Error("failed to create employee", zap.Error(err))
		return nil, errs.Internal("failed to create employee")
	}

	return &Response{Detail: dto.FromDetailRecord(*created)}, nil
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
		p.ParsedEmploymentStartDate.IsZero() {
		return errs.BadRequest("missing required fields")
	}
	return nil
}
