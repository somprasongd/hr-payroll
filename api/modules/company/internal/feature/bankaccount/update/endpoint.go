package update

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/company/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// CompanyBankAccount is the response type for documentation
type CompanyBankAccount = repository.CompanyBankAccount

// UpdateRequest represents the request body for updating a bank account
type UpdateRequest struct {
	BankID        uuid.UUID  `json:"bankId" validate:"required"`
	BranchID      *uuid.UUID `json:"branchId"`
	AccountNumber string     `json:"accountNumber" validate:"required,max=50"`
	AccountName   string     `json:"accountName" validate:"required,max=255"`
	IsActive      bool       `json:"isActive"`
}

// @Summary Update a company bank account
// @Tags Company Bank Accounts
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Param id path string true "Bank Account ID"
// @Param request body UpdateRequest true "Bank account payload"
// @Success 200 {object} CompanyBankAccount
// @Router /admin/company/bank-accounts/{id} [put]
func NewEndpoint(router fiber.Router) {
	router.Put("/bank-accounts/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		var req UpdateRequest
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		cmd := &Command{
			ID:            id,
			BankID:        req.BankID,
			BranchID:      req.BranchID,
			AccountNumber: req.AccountNumber,
			AccountName:   req.AccountName,
			IsActive:      req.IsActive,
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), cmd)
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Item)
	})
}
