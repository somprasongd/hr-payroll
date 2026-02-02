package update

import (
	"context"

	"github.com/google/uuid"

	"hrms/modules/company/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/validator"
)

type Command struct {
	ID            uuid.UUID
	BankID        uuid.UUID  `json:"bankId" validate:"required"`
	BranchID      *uuid.UUID `json:"branchId"` // nil = Central Account
	AccountNumber string     `json:"accountNumber" validate:"required,max=50"`
	AccountName   string     `json:"accountName" validate:"required,max=255"`
	IsActive      bool       `json:"isActive"`
}

type Response struct {
	Item *repository.CompanyBankAccount `json:"item"`
}

type commandHandler struct {
	repo repository.Repository
}

func NewHandler(repo repository.Repository) *commandHandler {
	return &commandHandler{repo: repo}
}

func (h *commandHandler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	if err := validator.Validate(cmd); err != nil {
		return nil, err
	}

	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing user context")
	}

	item, err := h.repo.UpdateBankAccount(ctx, cmd.ID, cmd.BankID, cmd.BranchID, cmd.AccountNumber, cmd.AccountName, cmd.IsActive, user.ID)
	if err != nil {
		return nil, errs.NotFound("bank account not found")
	}

	return &Response{Item: item}, nil
}
