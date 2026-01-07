package create

import (
	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/contracts"
)

// DocumentTypeRequest for creating document types
type DocumentTypeRequest struct {
	Code   string `json:"code"`
	NameTh string `json:"nameTh"`
	NameEn string `json:"nameEn"`
}

// @Summary Create a system document type
// @Tags SuperAdmin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body DocumentTypeRequest true "document type payload"
// @Success 201 {object} contracts.CreateSystemDocTypeResponse
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /super-admin/employee-document-types [post]
func NewEndpoint(router fiber.Router) {
	router.Post("/employee-document-types", func(c fiber.Ctx) error {
		var req DocumentTypeRequest
		if err := c.Bind().JSON(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		resp, err := mediator.Send[*contracts.CreateSystemDocTypeCommand, *contracts.CreateSystemDocTypeResponse](c.Context(), &contracts.CreateSystemDocTypeCommand{
			Code:    req.Code,
			NameTh:  req.NameTh,
			NameEn:  req.NameEn,
			ActorID: user.ID,
		})
		if err != nil {
			return err
		}

		return c.Status(fiber.StatusCreated).JSON(resp)
	})
}
