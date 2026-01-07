package get

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/contracts"
)

// @Summary Get a company by ID
// @Tags SuperAdmin
// @Produce json
// @Security BearerAuth
// @Param id path string true "company ID"
// @Success 200 {object} contracts.CompanyDTO
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /super-admin/companies/{id} [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/companies/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid company id")
		}

		resp, err := mediator.Send[*contracts.GetCompanyByIDQuery, *contracts.GetCompanyByIDResponse](c.Context(), &contracts.GetCompanyByIDQuery{
			ID: id,
		})
		if err != nil {
			return err
		}
		return c.JSON(resp.Company)
	})
}
