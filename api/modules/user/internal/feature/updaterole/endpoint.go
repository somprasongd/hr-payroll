package updaterole

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

type RequestBody struct {
	Role string `json:"role"`
}

// Update user role
// @Summary Update user role
// @Description แก้ไข role ผู้ใช้งาน (Admin)
// @Tags Admin Users
// @Accept json
// @Produce json
// @Param id path string true "user id"
// @Param request body RequestBody true "role payload"
// @Security BearerAuth
// @Success 200 {object} dto.User
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /admin/users/{id} [patch]
func NewEndpoint(router fiber.Router) {
	router.Patch("/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}
		var req RequestBody
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		actor, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user context")
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			ID:    id,
			Role:  req.Role,
			Actor: actor.ID,
		})
		if err != nil {
			return err
		}

		return response.JSON(c, fiber.StatusOK, resp.User)
	})
}
