package create

import (
	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary Create salary advance
// @Description สร้างรายการเบิกเงินล่วงหน้า (status pending)
// @Tags Salary Advance
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body Request true "salary advance payload"
// @Success 201 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Router /salary-advances [post]
func NewEndpoint(router fiber.Router) {
	router.Post("/", func(c fiber.Ctx) error {
		var req Request
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			Payload: req,
			ActorID: user.ID,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusCreated, resp.Item)
	})
}
