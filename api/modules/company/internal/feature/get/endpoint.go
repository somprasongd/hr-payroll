package get

import (
	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary Get current company
// @Tags Company
// @Produce json
// @Security BearerAuth
// @Success 200 {object} repository.Company
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
