package update

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary Update salary advance
// @Description แก้ไขยอด/วันที่ (เฉพาะ pending)
// @Tags Salary Advance
// @Accept json
// @Produce json
// @Param id path string true "advance id"
// @Param request body Request true "payload"
// @Security BearerAuth
// @Success 200 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Router /salary-advances/{id} [patch]
func NewEndpoint(router fiber.Router) {
	router.Patch("/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}
		var req Request
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			ID:      id,
			Payload: req,
			ActorID: user.ID,
		})
		if err != nil {
			return err
		}

		return response.JSON(c, fiber.StatusOK, resp.Item)
	})
}
