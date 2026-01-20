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
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/common/validator"
	"hrms/shared/contracts"
	"hrms/shared/events"
)

type Command struct {
	ID      uuid.UUID `validate:"required"`
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

	if err := validator.Validate(&cmd.Payload); err != nil {
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

	var updated *repository.DetailRecord
	err = h.tx.WithinTransaction(ctx, func(ctxWithTx context.Context, hook func(transactor.PostCommitHook)) error {
		prev, err := h.repo.Get(ctxWithTx, tenant, cmd.ID)
		if err != nil {
			return err
		}

		// Check if employee type is changing
		employeeTypeChanged := prev.EmployeeTypeID != cmd.Payload.EmployeeTypeID
		var prevTypeCode, newTypeCode string

		if employeeTypeChanged {
			// Get old and new employee type codes
			prevTypeCode, err = h.repo.GetEmployeeTypeCode(ctxWithTx, prev.EmployeeTypeID)
			if err != nil {
				logger.FromContext(ctx).Error("failed to get previous employee type code", zap.Error(err))
				return errs.Internal("failed to validate employee type change")
			}

			newTypeCode, err = h.repo.GetEmployeeTypeCode(ctxWithTx, cmd.Payload.EmployeeTypeID)
			if err != nil {
				logger.FromContext(ctx).Error("failed to get new employee type code", zap.Error(err))
				return errs.Internal("failed to validate employee type change")
			}

			// If changing FROM part_time, check for pending payout via mediator
			if prevTypeCode == "part_time" {
				resp, err := mediator.Send[*contracts.HasPendingPayoutPTQuery, *contracts.HasPendingPayoutPTResponse](
					ctxWithTx,
					&contracts.HasPendingPayoutPTQuery{EmployeeID: cmd.ID},
				)
				if err != nil {
					logger.FromContext(ctx).Error("failed to check pending payout", zap.Error(err))
					return errs.Internal("failed to validate employee type change")
				}
				if resp.HasPending {
					return errs.BadRequest("ไม่สามารถเปลี่ยนประเภทพนักงานได้ เนื่องจากยังมีรายการจ่ายค่าแรง PT ที่รอดำเนินการอยู่")
				}
			}
		}

		updated, err = h.repo.Update(ctxWithTx, tenant, cmd.ID, recPayload, user.ID)
		if err != nil {
			return err
		}

		// Handle employee type change side effects via mediator
		if employeeTypeChanged {
			// PT -> FT: Add to pending salary raise and bonus cycles
			if prevTypeCode == "part_time" && newTypeCode == "full_time" {
				// Add to salary raise cycle
				_, err := mediator.Send[*contracts.AddToSalaryRaiseCycleCommand, *contracts.AddToSalaryRaiseCycleResponse](
					ctxWithTx,
					&contracts.AddToSalaryRaiseCycleCommand{EmployeeID: cmd.ID, ActorID: user.ID},
				)
				if err != nil {
					logger.FromContext(ctx).Warn("failed to add employee to pending salary raise cycle", zap.Error(err))
				}

				// Add to bonus cycle
				_, err = mediator.Send[*contracts.AddToBonusCycleCommand, *contracts.AddToBonusCycleResponse](
					ctxWithTx,
					&contracts.AddToBonusCycleCommand{EmployeeID: cmd.ID, ActorID: user.ID},
				)
				if err != nil {
					logger.FromContext(ctx).Warn("failed to add employee to pending bonus cycle", zap.Error(err))
				}
			}

			// FT -> PT: Remove from pending salary raise and bonus cycles
			if prevTypeCode == "full_time" && newTypeCode == "part_time" {
				// Remove from salary raise cycle
				_, err := mediator.Send[*contracts.RemoveFromSalaryRaiseCycleCommand, *contracts.RemoveFromSalaryRaiseCycleResponse](
					ctxWithTx,
					&contracts.RemoveFromSalaryRaiseCycleCommand{EmployeeID: cmd.ID},
				)
				if err != nil {
					logger.FromContext(ctx).Warn("failed to remove employee from pending salary raise cycle", zap.Error(err))
				}

				// Remove from bonus cycle
				_, err = mediator.Send[*contracts.RemoveFromBonusCycleCommand, *contracts.RemoveFromBonusCycleResponse](
					ctxWithTx,
					&contracts.RemoveFromBonusCycleCommand{EmployeeID: cmd.ID},
				)
				if err != nil {
					logger.FromContext(ctx).Warn("failed to remove employee from pending bonus cycle", zap.Error(err))
				}
			}
		}

		if prev.PhotoID != nil && !uuidPtrEqual(prev.PhotoID, updated.PhotoID) {
			if err := h.repo.DeletePhoto(ctxWithTx, *prev.PhotoID); err != nil && !errors.Is(err, sql.ErrNoRows) {
				return err
			}
		}

		hook(func(ctx context.Context) error {
			h.eb.Publish(events.LogEvent{
				ActorID:    user.ID,
				CompanyID:  &tenant.CompanyID,
				BranchID:   tenant.BranchIDPtr(),
				Action:     "UPDATE",
				EntityName: "EMPLOYEE",
				EntityID:   cmd.ID.String(),
				Details: map[string]interface{}{
					"employeeNumber":             updated.EmployeeNumber,
					"titleId":                    updated.TitleID,
					"firstName":                  updated.FirstName,
					"lastName":                   updated.LastName,
					"nickname":                   updated.Nickname,
					"idDocumentTypeId":           updated.IDDocumentTypeID,
					"idDocumentNumber":           updated.IDDocumentNumber,
					"idDocumentOtherDescription": updated.IDDocumentOtherDescription,
					"phone":                      updated.Phone,
					"email":                      updated.Email,
					"employeeTypeId":             updated.EmployeeTypeID,
					"departmentId":               updated.DepartmentID,
					"positionId":                 updated.PositionID,
					"basePayAmount":              updated.BasePayAmount,
					"employmentStartDate":        updated.EmploymentStartDate,
					"employmentEndDate":          updated.EmploymentEndDate,
					"bankName":                   updated.BankName,
					"bankAccountNo":              updated.BankAccountNo,
					"ssoContribute":              updated.SSOContribute,
					"ssoDeclaredWage":            updated.SSODeclaredWage,
					"ssoHospitalName":            updated.SSOHospitalName,
					"providentFundContribute":    updated.ProvidentFundContribute,
					"providentFundRateEmployee":  updated.ProvidentFundRateEmployee,
					"providentFundRateEmployer":  updated.ProvidentFundRateEmployer,
					"withholdTax":                updated.WithholdTax,
					"allowHousing":               updated.AllowHousing,
					"allowWater":                 updated.AllowWater,
					"allowElectric":              updated.AllowElectric,
					"allowInternet":              updated.AllowInternet,
					"allowDoctorFee":             updated.AllowDoctorFee,
					"status":                     updated.Status,
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
		// Check if it's already a wrapped error
		var appErr *errs.AppError
		if errors.As(err, &appErr) {
			return nil, err
		}
		logger.FromContext(ctx).Error("failed to update employee", zap.Error(err))
		return nil, errs.Internal("failed to update employee")
	}

	return &Response{Detail: dto.FromDetailRecord(*updated)}, nil
}

func uuidPtrEqual(a, b *uuid.UUID) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
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
