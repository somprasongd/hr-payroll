package employeeposition

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary Create employee position
// @Tags Master
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateCommand true "position payload"
// @Success 201 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /master/employee-positions [post]
func NewCreateEndpoint(router fiber.Router) {
	router.Post("/", func(c fiber.Ctx) error {
		var req CreateCommand
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		resp, err := mediator.Send[*CreateCommand, *Response](c.Context(), &req)
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusCreated, resp.Record)
	})
}

// @Summary Update employee position
// @Tags Master
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "position id"
// @Param request body UpdateCommand true "position payload"
// @Success 200 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /master/employee-positions/{id} [patch]
func NewUpdateEndpoint(router fiber.Router) {
	router.Patch("/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		var req UpdateCommand
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		req.ID = id

		resp, err := mediator.Send[*UpdateCommand, *Response](c.Context(), &req)
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Record)
	})
}

// @Summary Soft delete employee position
// @Tags Master
// @Security BearerAuth
// @Param id path string true "position id"
// @Success 204
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /master/employee-positions/{id} [delete]
func NewDeleteEndpoint(router fiber.Router) {
	router.Delete("/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		_, err = mediator.Send[*DeleteCommand, mediator.NoResponse](c.Context(), &DeleteCommand{
			ID: id,
		})
		if err != nil {
			return err
		}
		return c.SendStatus(fiber.StatusNoContent)
	})
}
