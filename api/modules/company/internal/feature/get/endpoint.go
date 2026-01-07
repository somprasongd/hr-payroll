package get

import (
	"github.com/gofiber/fiber/v3"

	"hrms/modules/company/internal/repository"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// Company represents the company response for documentation
type Company = repository.Company

// @Summary Get current company
// @Tags Company
// @Produce json
// @Security BearerAuth
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Success 200 {object} Company
// @Router /admin/company/current [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/current", func(c fiber.Ctx) error {
		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Company)
	})
}
