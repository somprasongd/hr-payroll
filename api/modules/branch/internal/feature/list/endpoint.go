package list

import (
	"github.com/gofiber/fiber/v3"

	"hrms/modules/branch/internal/repository"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// Branch represents the branch response for documentation
type Branch = repository.Branch

// @Summary List all branches
// @Tags Branches
// @Produce json
// @Security BearerAuth
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Success 200 {array} Branch
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
