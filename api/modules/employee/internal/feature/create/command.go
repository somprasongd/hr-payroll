package create

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"go.uber.org/zap"

	"hrms/modules/employee/internal/dto"
	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/events"
)

type Command struct {
	Payload RequestBody
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
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing user context")
	}

	if err := validatePayload(cmd.Payload); err != nil {
		return nil, err
	}

	docCode, err := h.repo.GetIDDocumentTypeCode(ctx, cmd.Payload.IDDocumentTypeID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.BadRequest("invalid idDocumentTypeId")
		}
		return nil, errs.Internal("failed to fetch document type")
	}

	if strings.ToLower(docCode) == "other" {
		if cmd.Payload.IDDocumentOtherDescription == nil || strings.TrimSpace(*cmd.Payload.IDDocumentOtherDescription) == "" {
			return nil, errs.BadRequest("idDocumentOtherDescription is required when document type is 'other'")
		}
	} else {
		cmd.Payload.IDDocumentOtherDescription = nil
	}

	recPayload := cmd.Payload.ToDetailRecord()

	var created *repository.DetailRecord
	err = h.tx.WithinTransaction(ctx, func(ctxWithTx context.Context, hook func(transactor.PostCommitHook)) error {
		var err error
		created, err = h.repo.Create(ctxWithTx, recPayload, tenant.CompanyID, tenant.BranchID, user.ID)
		if err != nil {
			return err
		}

		hook(func(ctx context.Context) error {
			h.eb.Publish(events.LogEvent{
				ActorID:    user.ID,
				CompanyID:  &tenant.CompanyID,
				BranchID:   tenant.BranchIDPtr(),
				Action:     "CREATE",
				EntityName: "EMPLOYEE",
				EntityID:   created.ID.String(),
				Details: map[string]interface{}{
					"employeeNumber":             created.EmployeeNumber,
					"titleId":                    created.TitleID,
					"firstName":                  created.FirstName,
					"lastName":                   created.LastName,
					"nickname":                   created.Nickname,
					"idDocumentTypeId":           created.IDDocumentTypeID,
					"idDocumentNumber":           created.IDDocumentNumber,
					"idDocumentOtherDescription": created.IDDocumentOtherDescription,
					"phone":                      created.Phone,
					"email":                      created.Email,
					"employeeTypeId":             created.EmployeeTypeID,
					"departmentId":               created.DepartmentID,
					"positionId":                 created.PositionID,
					"basePayAmount":              created.BasePayAmount,
					"employmentStartDate":        created.EmploymentStartDate,
					"employmentEndDate":          created.EmploymentEndDate,
					"bankName":                   created.BankName,
					"bankAccountNo":              created.BankAccountNo,
					"ssoContribute":              created.SSOContribute,
					"ssoDeclaredWage":            created.SSODeclaredWage,
					"ssoHospitalName":            created.SSOHospitalName,
					"providentFundContribute":    created.ProvidentFundContribute,
					"providentFundRateEmployee":  created.ProvidentFundRateEmployee,
					"providentFundRateEmployer":  created.ProvidentFundRateEmployer,
					"withholdTax":                created.WithholdTax,
					"allowHousing":               created.AllowHousing,
					"allowWater":                 created.AllowWater,
					"allowElectric":              created.AllowElectric,
					"allowInternet":              created.AllowInternet,
					"allowDoctorFee":             created.AllowDoctorFee,
					"status":                     created.Status,
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
