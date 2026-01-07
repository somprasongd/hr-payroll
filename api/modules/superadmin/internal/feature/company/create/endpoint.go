package create

import (
	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

// CreateCompanyRequest for creating a new company with admin user
type CreateCompanyRequest struct {
	CompanyCode   string `json:"companyCode,omitempty" validate:"max=50"`
	CompanyName   string `json:"companyName"`
	AdminUsername string `json:"adminUsername"`
	AdminPassword string `json:"adminPassword"`
}

// @Summary Create a new company with admin user
// @Tags SuperAdmin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateCompanyRequest true "company and admin payload"
// @Success 201 {object} Response
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /super-admin/companies [post]
func NewEndpoint(router fiber.Router) {
	router.Post("/companies", func(c fiber.Ctx) error {
		var req CreateCompanyRequest
		if err := c.Bind().JSON(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		// Validate

		user, _ := contextx.UserFromContext(c.Context())

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			CompanyCode:   req.CompanyCode,
			CompanyName:   req.CompanyName,
			AdminUsername: req.AdminUsername,
			AdminPassword: req.AdminPassword,
			ActorID:       user.ID,
		})
		if err != nil {
			return err
		}
		return c.Status(fiber.StatusCreated).JSON(resp)
	})
}
