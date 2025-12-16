package publiclogo

import (
	"strconv"

	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/mediator"
)

// Get public logo for branding
// @Summary Download public logo for login page
// @Description ดาวน์โหลด logo สำหรับหน้า login โดยไม่ต้อง authenticate
// @Tags Public
// @Produce image/png
// @Produce image/jpeg
// @Success 200 {file} binary
// @Failure 404
// @Router /public/branding/logo [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/logo", func(c fiber.Ctx) error {
		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{})
		if err != nil {
			return err
		}
		c.Set(fiber.HeaderContentType, resp.ContentType)
		c.Set(fiber.HeaderContentLength, strconv.Itoa(int(resp.FileSizeBytes)))
		c.Set(fiber.HeaderETag, `W/"md5:`+resp.ChecksumMD5+`"`)
		c.Set(fiber.HeaderCacheControl, "public, max-age=86400")
		return c.Send(resp.Data)
	})
}
