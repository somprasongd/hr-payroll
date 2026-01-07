package publicbranding

import (
	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// Get public branding info
// @Summary Get public branding info for login page
// @Description ดึงข้อมูล branding (ชื่อบริษัท, logo URL) สำหรับหน้า login โดยไม่ต้อง authenticate
// @Tags Public
// @Produce json
// @Success 200 {object} BrandingResponse
// @Failure 404
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /public/branding [get]
func NewEndpoint(router fiber.Router) {
	router.Get("", func(c fiber.Ctx) error {
		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{})
		if err != nil {
			return err
		}

		return response.JSON(c, fiber.StatusOK, resp.Branding)
	})
}
