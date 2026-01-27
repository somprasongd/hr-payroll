package listusers

import (
	"github.com/gofiber/fiber/v3"

	"hrms/modules/userbranch/internal/repository"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// CompanyUser represents the user response for documentation
type CompanyUser = repository.CompanyUser

// @Summary List company users
// @Tags User-Branch Access
// @Produce json
// @Security BearerAuth
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Success 200 {array} CompanyUser
// @Router /admin/users [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/", func(c fiber.Ctx) error {
		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Users)
	})
}
