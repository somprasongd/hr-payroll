package items

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary List bonus items
// @Tags Bonus
// @Produce json
// @Security BearerAuth
// @Param id path string true "cycle id"
// @Param search query string false "search employee name"
// @Success 200 {object} ListResponse
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /bonus-cycles/{id}/items [get]
func RegisterList(router fiber.Router) {
	router.Get("/:id/items", func(c fiber.Ctx) error {
		cycleID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid cycle id")
		}
		search := c.Query("search")
		resp, err := mediator.Send[*ListQuery, *ListResponse](c.Context(), &ListQuery{
			CycleID: cycleID,
			Search:  search,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}

// @Summary Update bonus item
// @Tags Bonus
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "item id"
// @Param request body UpdateCommand true "payload"
// @Success 200 {object} UpdateResponse
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /bonus-items/{id} [patch]
func RegisterUpdate(router fiber.Router) {
	router.Patch("/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid item id")
		}
		var req UpdateCommand
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}
		req.ID = id
		req.Actor = user.ID

		resp, err := mediator.Send[*UpdateCommand, *UpdateResponse](c.Context(), &req)
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Item)
	})
}
