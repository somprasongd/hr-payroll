package create

import (
	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

type requestBody struct {
	Code   string `json:"code"`
	NameTh string `json:"nameTh"`
	NameEn string `json:"nameEn"`
}

// Create document type
// @Summary Create employee document type
// @Description สร้างประเภทเอกสารพนักงานใหม่
// @Tags Employee Document Types
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param body body requestBody true "payload"
// @Success 201 {object} Response
// @Failure 400
// @Failure 401
// @Failure 409
// @Router /employee-document-types [post]
func NewEndpoint(router fiber.Router) {
	router.Post("/", func(c fiber.Ctx) error {
		var body requestBody
		if err := c.Bind().JSON(&body); err != nil {
			return errs.BadRequest("invalid request body")
		}

		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			Code:    body.Code,
			NameTh:  body.NameTh,
			NameEn:  body.NameEn,
			ActorID: user.ID,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusCreated, resp)
	})
}
