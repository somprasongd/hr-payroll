package create

import (
	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

// CreateCompanyRequest for creating a new company with admin user
type CreateCompanyRequest struct {
	CompanyCode   string `json:"companyCode" validate:"required,max=50"`
	CompanyName   string `json:"companyName" validate:"required,max=200"`
	AdminUsername string `json:"adminUsername" validate:"required,min=3,max=50"`
	AdminPassword string `json:"adminPassword" validate:"required,min=8"`
}

// @Summary Create a new company with admin user
// @Tags SuperAdmin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateCompanyRequest true "company and admin payload"
// @Success 201 {object} Response
// @Router /super-admin/companies [post]
func NewEndpoint(router fiber.Router) {
	router.Post("/companies", func(c fiber.Ctx) error {
		var req CreateCompanyRequest
		if err := c.Bind().JSON(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		// Validate
		if req.CompanyCode == "" || req.CompanyName == "" {
			return errs.BadRequest("companyCode and companyName are required")
		}
		if req.AdminUsername == "" || req.AdminPassword == "" {
			return errs.BadRequest("adminUsername and adminPassword are required")
		}
		if len(req.AdminPassword) < 8 {
			return errs.BadRequest("password must be at least 8 characters")
		}

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
