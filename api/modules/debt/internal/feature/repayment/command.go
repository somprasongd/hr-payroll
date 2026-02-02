package repayment

import (
	"context"
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

type Command struct {
	EmployeeID        uuid.UUID  `json:"employeeId" validate:"required"`
	TxnDateRaw        string     `json:"txnDate" validate:"required"`
	Amount            float64    `json:"amount" validate:"required,gt=0"`
	Reason            *string    `json:"reason,omitempty"`
	PaymentMethod     *string    `json:"paymentMethod,omitempty"`
	BankID            *uuid.UUID `json:"bankId,omitempty"`
	BankAccountNumber *string    `json:"bankAccountNumber,omitempty"`
	TransferTime      *string    `json:"transferTime,omitempty"`
	ActorID           uuid.UUID  `validate:"required"`
}

type Response struct {
	dto.Item
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
	cmd.TxnDateRaw = strings.TrimSpace(cmd.TxnDateRaw)
	if err := validator.Validate(cmd); err != nil {
		return nil, err
	}

	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	txnDate, err := time.Parse("2006-01-02", cmd.TxnDateRaw)
	if err != nil {
		return nil, errs.BadRequest("txnDate must be YYYY-MM-DD")
	}

	if cmd.PaymentMethod != nil && *cmd.PaymentMethod == "bank_transfer" {
		if cmd.BankID == nil {
			return nil, errs.BadRequest("Bank is required")
		}
		if cmd.BankAccountNumber == nil || strings.TrimSpace(*cmd.BankAccountNumber) == "" {
			return nil, errs.BadRequest("Bank account number is required")
		}
		if cmd.TransferTime == nil || strings.TrimSpace(*cmd.TransferTime) == "" {
			return nil, errs.BadRequest("Transfer time is required")
		}
	}
	rec := repository.Record{
		EmployeeID:        cmd.EmployeeID,
		TxnDate:           txnDate,
		Amount:            cmd.Amount,
		Reason:            cmd.Reason,
		TxnType:           "repayment",
		Status:            "pending",
		PaymentMethod:     cmd.PaymentMethod,
		BankID:            cmd.BankID,
		BankAccountNumber: cmd.BankAccountNumber,
		TransferTime:      cmd.TransferTime,
	}

	var created *repository.Record
	if err := h.tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		created, err = h.repo.InsertRepayment(ctxTx, tenant, rec, cmd.ActorID)
		return err
	}); err != nil {
		logger.FromContext(ctx).Error("failed to create repayment", zap.Error(err))
		return nil, errs.Internal("failed to create repayment")
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		CompanyID:  &tenant.CompanyID,
		BranchID:   tenant.BranchIDPtr(),
		Action:     "CREATE",
		EntityName: "DEBT_REPAYMENT",
		EntityID:   created.ID.String(),
		Details: map[string]interface{}{
			"amount": cmd.Amount,
		},
		Timestamp: time.Now(),
	})

	return &Response{Item: dto.FromRecord(*created)}, nil
}
