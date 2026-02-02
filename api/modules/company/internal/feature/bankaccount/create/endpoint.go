package create

import (
	"github.com/gofiber/fiber/v3"

	"hrms/modules/company/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// CompanyBankAccount is the response type for documentation
type CompanyBankAccount = repository.CompanyBankAccount

// CreateRequest represents the request body for creating a bank account
type CreateRequest = Command

// @Summary Create a company bank account
// @Tags Company Bank Accounts
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Param request body CreateRequest true "Bank account payload"
// @Success 201 {object} CompanyBankAccount
// @Router /admin/company/bank-accounts [post]
func NewEndpoint(router fiber.Router) {
	router.Post("/bank-accounts", func(c fiber.Ctx) error {
		var req Command
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &req)
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusCreated, resp.Item)
	})
}
