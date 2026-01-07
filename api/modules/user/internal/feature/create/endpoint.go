package create

import (
	"github.com/gofiber/fiber/v3"

	"hrms/modules/user/internal/dto"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// User represents the user response for documentation
type User = dto.User

type RequestBody struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

// Create user
// @Summary Create user
// @Description สร้างผู้ใช้งานใหม่ (Admin)
// @Tags Admin Users
// @Accept json
// @Produce json
// @Param request body RequestBody true "user payload"
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Security BearerAuth
// @Success 201 {object} User
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 409
// @Router /admin/users [post]
func NewEndpoint(router fiber.Router) {
	router.Post("/", func(c fiber.Ctx) error {
		var req RequestBody
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		actor, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user context")
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			Username: req.Username,
			Password: req.Password,
			Role:     req.Role,
			ActorID:  actor.ID,
		})
		if err != nil {
			return err
		}

		return response.JSON(c, fiber.StatusCreated, resp.User)
	})
}
