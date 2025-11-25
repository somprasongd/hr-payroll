package accum

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary List accumulations
// @Tags Employees
// @Produce json
// @Security BearerAuth
// @Param id path string true "employee id"
// @Success 200 {object} ListResponse
// @Router /employees/{id}/accumulations [get]
func RegisterRead(router fiber.Router) {
	router.Get("/:id/accumulations", func(c fiber.Ctx) error {
		empID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid employee id")
		}
		resp, err := mediator.Send[*ListQuery, *ListResponse](c.Context(), &ListQuery{
			EmployeeID: empID,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Data)
	})
}

func RegisterMutate(router fiber.Router) {
	// create/update
	router.Post("/:id/accumulations", func(c fiber.Ctx) error {
		empID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid employee id")
		}
		var req UpsertCommand
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}
		req.EmployeeID = empID
		req.Actor = user.ID

		resp, err := mediator.Send[*UpsertCommand, *UpsertResponse](c.Context(), &req)
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusCreated, resp.Record)
	})

	router.Delete("/accumulations/:accumId", func(c fiber.Ctx) error {
		accumID, err := uuid.Parse(c.Params("accumId"))
		if err != nil {
			return errs.BadRequest("invalid accumulation id")
		}
		if _, err := mediator.Send[*DeleteCommand, mediator.NoResponse](c.Context(), &DeleteCommand{
			ID: accumID,
		}); err != nil {
			return err
		}
		return c.SendStatus(fiber.StatusNoContent)
	})
}
