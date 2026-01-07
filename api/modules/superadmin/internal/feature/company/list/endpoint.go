package list

import (
	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/mediator"
	"hrms/shared/contracts"
)

// @Summary List all companies
// @Tags SuperAdmin
// @Produce json
// @Security BearerAuth
// @Success 200 {array} contracts.CompanyDTO
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /super-admin/companies [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/companies", func(c fiber.Ctx) error {
		resp, err := mediator.Send[*contracts.ListAllCompaniesQuery, *contracts.ListAllCompaniesResponse](c.Context(), &contracts.ListAllCompaniesQuery{})
		if err != nil {
			return err
		}
		return c.JSON(resp.Companies)
	})
}
