package bank

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// ==========================================
// Company Banks (for Admin)
// ==========================================

// @Summary List company banks (combined system + custom)
// @Tags Master
// @Produce json
// @Security BearerAuth
// @Param admin query bool false "If true, returns all banks including disabled system ones"
// @Success 200 {object} ListResponse
// @Failure 401
// @Failure 403
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /master/banks [get]
func NewListEndpoint(router fiber.Router) {
	router.Get("/", func(c fiber.Ctx) error {
		tenant, ok := contextx.TenantFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing tenant context")
		}

		isAdmin := c.Query("admin") == "true"

		resp, err := mediator.Send[*ListQuery, *ListResponse](c.Context(), &ListQuery{
			CompanyID: tenant.CompanyID,
			IsAdmin:   isAdmin,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Records)
	})
}

// @Summary Create custom bank for company
// @Tags Master
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateCommand true "bank payload"
// @Success 201 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /master/banks [post]
func NewCreateEndpoint(router fiber.Router) {
	router.Post("/", func(c fiber.Ctx) error {
		tenant, ok := contextx.TenantFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing tenant context")
		}

		var req CreateCommand
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		req.IsSystem = false
		req.CompanyID = &tenant.CompanyID

		resp, err := mediator.Send[*CreateCommand, *Response](c.Context(), &req)
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusCreated, resp.Record)
	})
}

// @Summary Update custom bank for company
// @Tags Master
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "bank id"
// @Param request body UpdateCommand true "bank payload"
// @Success 200 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /master/banks/{id} [patch]
func NewUpdateEndpoint(router fiber.Router) {
	update := func(c fiber.Ctx) error {
		tenant, ok := contextx.TenantFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing tenant context")
		}

		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		var req UpdateCommand
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		req.ID = id
		req.IsSystem = false
		req.CompanyID = &tenant.CompanyID

		resp, err := mediator.Send[*UpdateCommand, *Response](c.Context(), &req)
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Record)
	}
	router.Put("/:id", update)
	router.Patch("/:id", update)
}

// @Summary Soft delete custom bank for company
// @Tags Master
// @Security BearerAuth
// @Param id path string true "bank id"
// @Success 204
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /master/banks/{id} [delete]
func NewDeleteEndpoint(router fiber.Router) {
	router.Delete("/:id", func(c fiber.Ctx) error {
		tenant, ok := contextx.TenantFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing tenant context")
		}

		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		_, err = mediator.Send[*DeleteCommand, mediator.NoResponse](c.Context(), &DeleteCommand{
			ID:        id,
			IsSystem:  false,
			CompanyID: &tenant.CompanyID,
		})
		if err != nil {
			return err
		}
		return c.SendStatus(fiber.StatusNoContent)
	})
}

// @Summary Toggle system bank visibility for company
// @Tags Master
// @Accept json
// @Security BearerAuth
// @Param id path string true "bank id"
// @Param request body ToggleCommand true "toggle payload"
// @Success 204
// @Failure 400
// @Failure 401
// @Failure 403
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /master/banks/{id}/toggle [post]
func NewToggleEndpoint(router fiber.Router) {
	router.Post("/:id/toggle", func(c fiber.Ctx) error {
		tenant, ok := contextx.TenantFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing tenant context")
		}

		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		var req ToggleCommand
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		req.BankID = id
		req.CompanyID = tenant.CompanyID

		_, err = mediator.Send[*ToggleCommand, mediator.NoResponse](c.Context(), &req)
		if err != nil {
			return err
		}
		return c.SendStatus(fiber.StatusNoContent)
	})
}

// ==========================================
// System Banks (for Superadmin)
// ==========================================

// @Summary List all system banks
// @Tags Master
// @Produce json
// @Security BearerAuth
// @Success 200 {object} ListSystemBanksResponse
// @Failure 401
// @Failure 403
// @Router /master/system-banks [get]
func NewListSystemBanksEndpoint(router fiber.Router) {
	router.Get("/", func(c fiber.Ctx) error {
		resp, err := mediator.Send[*ListSystemBanksQuery, *ListSystemBanksResponse](c.Context(), &ListSystemBanksQuery{})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Records)
	})
}

// @Summary Create system bank
// @Tags Master
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateCommand true "bank payload"
// @Success 201 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Router /master/system-banks [post]
func NewCreateSystemBankEndpoint(router fiber.Router) {
	router.Post("/", func(c fiber.Ctx) error {
		var req CreateCommand
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		req.IsSystem = true
		req.CompanyID = nil

		resp, err := mediator.Send[*CreateCommand, *Response](c.Context(), &req)
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusCreated, resp.Record)
	})
}

// @Summary Update system bank
// @Tags Master
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "bank id"
// @Param request body UpdateCommand true "bank payload"
// @Success 200 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Router /master/system-banks/{id} [patch]
func NewUpdateSystemBankEndpoint(router fiber.Router) {
	update := func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		var req UpdateCommand
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		req.ID = id
		req.IsSystem = true
		req.CompanyID = nil

		resp, err := mediator.Send[*UpdateCommand, *Response](c.Context(), &req)
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Record)
	}
	router.Put("/:id", update)
	router.Patch("/:id", update)
}

// @Summary Soft delete system bank
// @Tags Master
// @Security BearerAuth
// @Param id path string true "bank id"
// @Success 204
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Router /master/system-banks/{id} [delete]
func NewDeleteSystemBankEndpoint(router fiber.Router) {
	router.Delete("/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		_, err = mediator.Send[*DeleteCommand, mediator.NoResponse](c.Context(), &DeleteCommand{
			ID:        id,
			IsSystem:  true,
			CompanyID: nil,
		})
		if err != nil {
			return err
		}
		return c.SendStatus(fiber.StatusNoContent)
	})
}

// @Summary Toggle system bank active status (system-wide)
// @Tags Master
// @Accept json
// @Security BearerAuth
// @Param id path string true "bank id"
// @Param request body ToggleActiveCommand true "toggle active payload"
// @Success 204
// @Failure 400
// @Failure 41
// @Failure 403
// @Router /super-admin/master/system-banks/{id}/toggle [post]
func NewToggleSystemBankEndpoint(router fiber.Router) {
	router.Post("/:id/toggle", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		var req ToggleActiveCommand
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		req.ID = id

		_, err = mediator.Send[*ToggleActiveCommand, mediator.NoResponse](c.Context(), &req)
		if err != nil {
			return err
		}
		return c.SendStatus(fiber.StatusNoContent)
	})
}
