package get

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary Get bonus cycle detail
// @Description ดูรายละเอียดรอบโบนัส (รวม items)
// @Tags Bonus
// @Produce json
// @Param id path string true "cycle id"
// @Security BearerAuth
// @Success 200 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Router /bonus-cycles/{id} [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}
		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			ID: id,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Cycle)
	})
}
