package update

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/employee/internal/feature/create"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

type RequestBody = create.RequestBody

// Update employee
// @Summary Update employee
// @Description แก้ไขข้อมูลพนักงาน
// @Tags Employees
// @Accept json
// @Produce json
// @Param id path string true "employee id"
// @Param request body create.RequestBody true "employee payload"
// @Security BearerAuth
// @Success 200 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Router /employees/{id} [put]
func NewEndpoint(router fiber.Router) {
	router.Put("/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		var req create.RequestBody
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
		return response.JSON(c, fiber.StatusOK, resp.Detail)
	})
}
