package list

import (
	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary List all branches
// @Tags Branches
// @Produce json
// @Security BearerAuth
// @Success 200 {array} repository.Branch
// @Router /admin/branches [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/", func(c fiber.Ctx) error {
		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Branches)
	})
}
