package approve

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary Approve loan
// @Description อนุมัติเงินกู้ (admin only)
// @Tags Debt
// @Security BearerAuth
// @Param id path string true "transaction id"
// @Success 200 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Router /debt-txns/{id}/approve [post]
func NewEndpoint(router fiber.Router) {
	router.Post("/:id/approve", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			ID:    id,
			Actor: user.ID,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
