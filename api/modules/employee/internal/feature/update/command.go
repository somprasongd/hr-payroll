package update

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

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

	var updated *repository.DetailRecord
	err := h.tx.WithinTransaction(ctx, func(ctxWithTx context.Context, hook func(transactor.PostCommitHook)) error {
		var err error
		updated, err = h.repo.Update(ctxWithTx, cmd.ID, recPayload, cmd.ActorID)
		if err != nil {
			return err
		}

		hook(func(ctx context.Context) error {
			h.eb.Publish(events.LogEvent{
				ActorID:    cmd.ActorID,
				Action:     "UPDATE",
				EntityName: "EMPLOYEE",
				EntityID:   cmd.ID.String(),
				Details: map[string]interface{}{
					"code":                    updated.EmployeeNumber,
					"firstName":               updated.FirstName,
					"lastName":                updated.LastName,
					"idDocumentNumber":        updated.IDDocumentNumber,
					"phone":                   updated.Phone,
					"email":                   updated.Email,
					"employeeTypeId":          updated.EmployeeTypeID,
					"departmentId":            updated.DepartmentID,
					"positionId":              updated.PositionID,
					"basePayAmount":           updated.BasePayAmount,
					"employmentStartDate":     updated.EmploymentStartDate,
					"ssoContribute":           updated.SSOContribute,
					"providentFundContribute": updated.ProvidentFundContribute,
					"status":                  updated.Status,
					"bankName":                updated.BankName,
					"bankAccountNo":           updated.BankAccountNo,
					"allowHousing":            updated.AllowHousing,
					"allowWater":              updated.AllowWater,
					"allowElectric":           updated.AllowElectric,
					"allowInternet":           updated.AllowInternet,
					"allowDoctorFee":          updated.AllowDoctorFee,
				},
				Timestamp: time.Now(),
			})
			return nil
		})

		return nil
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			logger.FromContext(ctx).Warn("employee not found for update", zap.Error(err))
			return nil, errs.NotFound("employee not found")
		}
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			logger.FromContext(ctx).Warn("duplicate employee number", zap.Error(err))
			return nil, errs.Conflict("employeeNumber already exists for active employee")
		}
		logger.FromContext(ctx).Error("failed to update employee", zap.Error(err))
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
		p.ParsedEmploymentStartDate.IsZero() {
		return errs.BadRequest("missing required fields")
	}
	return nil
}
