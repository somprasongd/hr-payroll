package listusers

import (
	"github.com/gofiber/fiber/v3"

	"hrms/modules/userbranch/internal/repository"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary List company users
// @Tags UserBranch
// @Produce json
// @Security BearerAuth
// @Success 200 {array} repository.CompanyUser
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /admin/users [get]
func NewEndpoint(router fiber.Router, repo repository.Repository) {
	router.Get("/", func(c fiber.Ctx) error {
		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			Repo: repo,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Users)
	})
}
