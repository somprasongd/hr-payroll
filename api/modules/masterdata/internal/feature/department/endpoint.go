package department

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary Create department
// @Tags Master
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateCommand true "department payload"
// @Success 201 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Router /master/departments [post]
func NewCreateEndpoint(router fiber.Router) {
	router.Post("/", func(c fiber.Ctx) error {
		var req CreateCommand
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}
		req.ActorID = user.ID

		tenant, ok := contextx.TenantFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing tenant context")
		}
		req.CompanyID = tenant.CompanyID

		resp, err := mediator.Send[*CreateCommand, *Response](c.Context(), &req)
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusCreated, resp.Record)
	})
}

// @Summary Update department
// @Tags Master
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "department id"
// @Param request body UpdateCommand true "department payload"
// @Success 200 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Router /master/departments/{id} [patch]
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

		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		tenant, ok := contextx.TenantFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing tenant context")
		}

		req.ID = id
		req.CompanyID = tenant.CompanyID
		req.ActorID = user.ID

		resp, err := mediator.Send[*UpdateCommand, *Response](c.Context(), &req)
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Record)
	})
}

// @Summary Soft delete department
// @Tags Master
// @Security BearerAuth
// @Param id path string true "department id"
// @Success 204
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Router /master/departments/{id} [delete]
func NewDeleteEndpoint(router fiber.Router) {
	router.Delete("/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		tenant, ok := contextx.TenantFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing tenant context")
		}

		_, err = mediator.Send[*DeleteCommand, mediator.NoResponse](c.Context(), &DeleteCommand{
			ID:        id,
			CompanyID: tenant.CompanyID,
			ActorID:   user.ID,
		})
		if err != nil {
			return err
		}
		return c.SendStatus(fiber.StatusNoContent)
	})
}
