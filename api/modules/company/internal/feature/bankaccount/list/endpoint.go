package list

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/company/internal/repository"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// CompanyBankAccount is the response type for documentation
type CompanyBankAccount = repository.CompanyBankAccount

// @Summary List company bank accounts
// @Tags Company Bank Accounts
// @Produce json
// @Security BearerAuth
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Param branchId query string false "Filter by branch ID (or 'central' for central accounts only)"
// @Param includeCentral query bool false "Include central accounts along with branch filter (default: false)"
// @Param isActive query bool false "Filter by active status"
// @Success 200 {array} CompanyBankAccount
// @Router /admin/company/bank-accounts [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/bank-accounts", func(c fiber.Ctx) error {
		q := &Query{}

		// Parse branchId param
		branchIDStr := c.Query("branchId")
		if branchIDStr != "" && branchIDStr != "central" {
			branchID, err := uuid.Parse(branchIDStr)
			if err == nil {
				q.BranchID = &branchID
			}
		}

		// Parse includeCentral param (default is false)
		// If branchId is "central", we want only central accounts
		if branchIDStr == "central" {
			q.IncludeCentral = true
		} else if c.Query("includeCentral") == "true" {
			q.IncludeCentral = true
		}

		// Parse isActive param
		isActiveStr := c.Query("isActive")
		if isActiveStr != "" {
			isActive := isActiveStr == "true"
			q.IsActive = &isActive
		}

		resp, err := mediator.Send[*Query, *Response](c.Context(), q)
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Items)
	})
}
