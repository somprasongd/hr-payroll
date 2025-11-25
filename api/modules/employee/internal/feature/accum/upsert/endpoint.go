package upsert

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary Upsert accumulation
// @Tags Employees
// @Produce json
// @Security BearerAuth
// @Param id path string true "employee id"
// @Success 201 {object} Response
// @Router /employees/{id}/accumulations [post]
func NewEndpoint(router fiber.Router) {
	router.Post("/:id/accumulations", func(c fiber.Ctx) error {
		empID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid employee id")
		}
		var req Command
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}
		req.EmployeeID = empID
		req.Actor = user.ID

		resp, err := mediator.Send[*Command, *Response](c.Context(), &req)
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusCreated, resp)
	})
}
