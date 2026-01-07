package update

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/contracts"
)

// DocumentTypeRequest for updating document types
type DocumentTypeRequest struct {
	Code   string `json:"code"`
	NameTh string `json:"nameTh"`
	NameEn string `json:"nameEn"`
}

// @Summary Update a system document type
// @Tags SuperAdmin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "document type ID"
// @Param request body DocumentTypeRequest true "document type payload"
// @Success 200 {object} contracts.UpdateSystemDocTypeResponse
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /super-admin/employee-document-types/{id} [put]
func NewEndpoint(router fiber.Router) {
	router.Put("/employee-document-types/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid document type id")
		}

		var req DocumentTypeRequest
		if err := c.Bind().JSON(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		resp, err := mediator.Send[*contracts.UpdateSystemDocTypeCommand, *contracts.UpdateSystemDocTypeResponse](c.Context(), &contracts.UpdateSystemDocTypeCommand{
			ID:      id,
			Code:    req.Code,
			NameTh:  req.NameTh,
			NameEn:  req.NameEn,
			ActorID: user.ID,
		})
		if err != nil {
			return err
		}

		return c.JSON(resp)
	})
}
