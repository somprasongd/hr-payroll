package updaterole

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/user/internal/dto"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// User represents the user response for documentation
type User = dto.User

type RequestBody struct {
	Role string `json:"role"`
}

// @Summary Update user role
// @Tags Admin Users
// @Accept json
// @Produce json
// @Param id path string true "user id"
// @Param request body RequestBody true "role payload"
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Security BearerAuth
// @Success 200 {object} User
// @Router /admin/users/{id}/role [put]
func NewEndpoint(router fiber.Router) {
	router.Put("/:id/role", func(c fiber.Ctx) error {
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
