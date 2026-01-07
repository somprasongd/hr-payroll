package createplan

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/debt/internal/dto"
	"hrms/modules/debt/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/common/validator"
	"hrms/shared/events"
)

type Installment struct {
	Amount           float64 `json:"amount" validate:"required,gt=0"`
	PayrollMonthDate string  `json:"payrollMonthDate" validate:"required"`
}

type Command struct {
	EmployeeID   uuid.UUID     `json:"employeeId" validate:"required"`
	TxnType      string        `json:"txnType" validate:"required,oneof=loan other"`
	OtherDesc    *string       `json:"otherDesc,omitempty"`
	TxnDate      string        `json:"txnDate" validate:"required"`
	Amount       float64       `json:"amount" validate:"required,gt=0"`
	Reason       *string       `json:"reason,omitempty"`
	Installments []Installment `json:"installments" validate:"dive"`
	ActorID      uuid.UUID     `validate:"required"`
}

type Response struct {
	dto.Item
	Message string `json:"message"`
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
	if err := validator.Validate(cmd); err != nil {
		return nil, err
	}

	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	txnDate, parsedInstallments, err := validateDates(cmd)
	if err != nil {
		return nil, err
	}
	if len(parsedInstallments) > 0 {
		sum := 0.0
		for _, ins := range parsedInstallments {
			sum += ins.Amount
		}
		if sum != cmd.Amount {
			return nil, errs.BadRequest("sum of installments must equal amount")
		}
	}

	parentRec := repository.Record{
		EmployeeID: cmd.EmployeeID,
		TxnDate:    txnDate,
		TxnType:    cmd.TxnType,
		OtherDesc:  cmd.OtherDesc,
		Amount:     cmd.Amount,
		Reason:     cmd.Reason,
		Status:     "pending",
	}

	var createdParent *repository.Record
	if err := h.tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		createdParent, err = h.repo.InsertParent(ctxTx, tenant, parentRec, cmd.ActorID)
		if err != nil {
			return err
		}
		if len(parsedInstallments) == 0 {
			return nil
		}
		installments := make([]repository.Record, 0, len(parsedInstallments))
		for _, ins := range parsedInstallments {
			installments = append(installments, repository.Record{
				TxnDate:      ins.PayrollMonthDate, // use payroll month as txn_date for child (any date ok)
				Amount:       ins.Amount,
				PayrollMonth: &ins.PayrollMonthDate,
				Reason:       cmd.Reason,
			})
		}
		return h.repo.InsertInstallments(ctxTx, tenant, createdParent.ID, cmd.EmployeeID, installments, cmd.ActorID)
	}); err != nil {
		logger.FromContext(ctx).Error("failed to create debt plan", zap.Error(err))
		return nil, errs.Internal("failed to create debt plan")
	}

	resp := dto.FromRecord(*createdParent)
	message := "Loan request created."
	if count := len(parsedInstallments); count > 0 {
		message = fmt.Sprintf("Loan request created with %d installments.", count)
	}
	h.eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		CompanyID:  &tenant.CompanyID,
		BranchID:   tenant.BranchIDPtr(),
		Action:     "CREATE",
		EntityName: "DEBT_PLAN",
		EntityID:   createdParent.ID.String(),
		Details: map[string]interface{}{
			"amount":  cmd.Amount,
			"txnType": cmd.TxnType,
		},
		Timestamp: time.Now(),
	})

	return &Response{
		Item:    resp,
		Message: message,
	}, nil
}

type parsedInstallment struct {
	Amount           float64
	PayrollMonthDate time.Time
}

// validateDates handles date parsing and business logic validation
func validateDates(cmd *Command) (time.Time, []parsedInstallment, error) {
	// Validate otherDesc for txnType other
	if cmd.TxnType == "other" {
		if cmd.OtherDesc == nil || strings.TrimSpace(*cmd.OtherDesc) == "" {
			return time.Time{}, nil, errs.BadRequest("otherDesc is required for txnType other")
		}
	}

	txnDate, err := time.Parse("2006-01-02", strings.TrimSpace(cmd.TxnDate))
	if err != nil {
		return time.Time{}, nil, errs.BadRequest("txnDate must be YYYY-MM-DD")
	}

	parsedInst := make([]parsedInstallment, 0, len(cmd.Installments))
	for _, ins := range cmd.Installments {
		payrollDate, err := time.Parse("2006-01-02", strings.TrimSpace(ins.PayrollMonthDate))
		if err != nil {
			return time.Time{}, nil, errs.BadRequest("payrollMonthDate must be YYYY-MM-DD")
		}
		if payrollDate.Day() != 1 {
			return time.Time{}, nil, errs.BadRequest("payrollMonthDate must be first day of month")
		}
		parsedInst = append(parsedInst, parsedInstallment{
			Amount:           ins.Amount,
			PayrollMonthDate: payrollDate,
		})
	}
	return txnDate, parsedInst, nil
}
