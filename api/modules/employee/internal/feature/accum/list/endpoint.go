package list

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary List accumulations
// @Tags Employees
// @Produce json
// @Security BearerAuth
// @Param id path string true "employee id"
// @Success 200 {object} Response
// @Router /employees/{id}/accumulations [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/:id/accumulations", func(c fiber.Ctx) error {
		empID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid employee id")
		}
		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			EmployeeID: empID,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
