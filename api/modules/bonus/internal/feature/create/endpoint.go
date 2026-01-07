package create

import (
	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary Create bonus cycle
// @Description สร้างรอบโบนัส (pending) — มีได้ครั้งละ 1 pending ต่อสาขา และไม่อนุญาตงวดเงินเดือนที่มีรอบอนุมัติแล้วในสาขาเดียวกัน
// @Tags Bonus
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body Command true "payload"
// @Success 201 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 409 {object} response.Problem "เมื่อมี pending หรือ approved เดือนเดียวกันอยู่แล้ว"
// @Router /bonus-cycles [post]
func NewEndpoint(router fiber.Router) {
	router.Post("/", func(c fiber.Ctx) error {
		var req Command
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}
		if err := req.ParseDates(); err != nil {
			return err
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &req)
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusCreated, resp.Cycle)
	})
}
