package list

import (
	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/mediator"
	"hrms/shared/contracts"
)

// @Summary List all system document types
// @Tags SuperAdmin
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{}
// @Router /super-admin/employee-document-types [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/employee-document-types", func(c fiber.Ctx) error {
		resp, err := mediator.Send[*contracts.ListSystemDocTypesQuery, *contracts.ListSystemDocTypesResponse](c.Context(), &contracts.ListSystemDocTypesQuery{})
		if err != nil {
			return err
		}
		return c.JSON(fiber.Map{"items": resp.Items})
	})
}
