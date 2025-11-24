package login

import (
	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

type RequestBody struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// Login endpoint
// @Summary Login
// @Description เข้าสู่ระบบเพื่อรับ Access/Refresh Token
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body RequestBody true "credentials"
// @Success 200 {object} Response
// @Failure 400
// @Failure 401
// @Router /auth/login [post]
func NewEndpoint(router fiber.Router) {
	router.Post("/login", func(c fiber.Ctx) error {
		var req RequestBody
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			Username:  req.Username,
			Password:  req.Password,
			IP:        c.IP(),
			UserAgent: c.Get("User-Agent"),
		})
		if err != nil {
			return err
		}

		return response.JSON(c, fiber.StatusOK, resp)
	})
}
