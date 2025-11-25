package createplan

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/debt/internal/dto"
	"hrms/modules/debt/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
)

type Installment struct {
	Amount           float64   `json:"amount"`
	PayrollMonthDate time.Time `json:"payrollMonthDate"`
}

type Command struct {
	EmployeeID   uuid.UUID     `json:"employeeId"`
	TxnType      string        `json:"txnType"` // loan|other
	OtherDesc    *string       `json:"otherDesc,omitempty"`
	TxnDate      time.Time     `json:"txnDate"`
	Amount       float64       `json:"amount"`
	Reason       *string       `json:"reason,omitempty"`
	Installments []Installment `json:"installments"`
	ActorID      uuid.UUID
}

type Response struct {
	dto.Item
	Message string `json:"message"`
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
	if err := validate(cmd); err != nil {
		return nil, err
	}
	sum := 0.0
	for _, ins := range cmd.Installments {
		sum += ins.Amount
	}
	if sum != cmd.Amount {
		return nil, errs.BadRequest("sum of installments must equal amount")
	}

	parentRec := repository.Record{
		EmployeeID: cmd.EmployeeID,
		TxnDate:    cmd.TxnDate,
		TxnType:    cmd.TxnType,
		OtherDesc:  cmd.OtherDesc,
		Amount:     cmd.Amount,
		Reason:     cmd.Reason,
		Status:     "pending",
	}

	var createdParent *repository.Record
	if err := h.tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		createdParent, err = h.repo.InsertParent(ctxTx, parentRec, cmd.ActorID)
		if err != nil {
			return err
		}
		installments := make([]repository.Record, 0, len(cmd.Installments))
		for _, ins := range cmd.Installments {
			installments = append(installments, repository.Record{
				TxnDate:      ins.PayrollMonthDate, // use payroll month as txn_date for child (any date ok)
				Amount:       ins.Amount,
				PayrollMonth: &ins.PayrollMonthDate,
				Reason:       cmd.Reason,
			})
		}
		return h.repo.InsertInstallments(ctxTx, createdParent.ID, cmd.EmployeeID, installments, cmd.ActorID)
	}); err != nil {
		logger.FromContext(ctx).Error("failed to create debt plan", zap.Error(err))
		return nil, errs.Internal("failed to create debt plan")
	}

	resp := dto.FromRecord(*createdParent)
	return &Response{
		Item:    resp,
		Message: "Loan request created with installments.",
	}, nil
}

func validate(cmd *Command) error {
	if cmd.EmployeeID == uuid.Nil {
		return errs.BadRequest("employeeId is required")
	}
	switch cmd.TxnType {
	case "loan":
	case "other":
		if cmd.OtherDesc == nil || strings.TrimSpace(*cmd.OtherDesc) == "" {
			return errs.BadRequest("otherDesc is required for txnType other")
		}
	default:
		return errs.BadRequest("invalid txnType")
	}
	if cmd.TxnDate.IsZero() {
		return errs.BadRequest("txnDate is required")
	}
	if cmd.Amount <= 0 {
		return errs.BadRequest("amount must be > 0")
	}
	if len(cmd.Installments) == 0 {
		return errs.BadRequest("installments required")
	}
	for _, ins := range cmd.Installments {
		if ins.Amount <= 0 {
			return errs.BadRequest("installment amount must be > 0")
		}
		if ins.PayrollMonthDate.IsZero() || ins.PayrollMonthDate.Day() != 1 {
			return errs.BadRequest("payrollMonthDate must be first day of month")
		}
	}
	return nil
}
