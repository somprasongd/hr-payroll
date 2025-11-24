package resetpassword

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

type RequestBody struct {
	NewPassword string `json:"newPassword"`
}

// Admin reset password
// @Summary Admin reset password
// @Description Admin รีเซ็ต password ให้ user
// @Tags Admin Users
// @Accept json
// @Produce json
// @Param id path string true "user id"
// @Param request body RequestBody true "new password"
// @Security BearerAuth
// @Success 200 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Router /admin/users/{id}/password-reset [post]
func NewEndpoint(router fiber.Router) {
	router.Post("/users/:id/password-reset", func(c fiber.Ctx) error {
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
			ID:          id,
			NewPassword: req.NewPassword,
			Actor:       actor.ID,
		})
		if err != nil {
			return err
		}

		return response.JSON(c, fiber.StatusOK, resp)
	})
}
