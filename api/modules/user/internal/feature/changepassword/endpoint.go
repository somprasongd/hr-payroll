package changepassword

import (
	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

type RequestBody struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

// Change own password
// @Summary Change own password
// @Description ผู้ใช้เปลี่ยนรหัสผ่านของตัวเอง
// @Tags Me
// @Accept json
// @Produce json
// @Param request body RequestBody true "password payload"
// @Security BearerAuth
// @Success 200 {object} Response
// @Failure 400
// @Failure 401
// @Failure 422
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /me/password [put]
func NewEndpoint(router fiber.Router) {
	router.Put("/password", func(c fiber.Ctx) error {
		var req RequestBody
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user context")
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			UserID:          user.ID,
			CurrentPassword: req.CurrentPassword,
			NewPassword:     req.NewPassword,
		})
		if err != nil {
			return err
		}

		return response.JSON(c, fiber.StatusOK, resp)
	})
}
