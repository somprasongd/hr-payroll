package download

import (
	"strconv"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

// Download employee photo
// @Summary Download employee photo by ID
// @Tags Employees
// @Produce image/png
// @Produce image/jpeg
// @Security BearerAuth
// @Param id path string true "photo id"
// @Success 200 {file} binary
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Router /employees/photos/{id} [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/:id", func(c fiber.Ctx) error {
		idStr := c.Params("id")
		id, err := uuid.Parse(idStr)
		if err != nil {
			return errs.BadRequest("invalid id")
		}
		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{ID: id})
		if err != nil {
			return err
		}
		c.Set(fiber.HeaderContentType, resp.Record.ContentType)
		c.Set(fiber.HeaderContentLength, strconv.Itoa(int(resp.Record.FileSizeBytes)))
		c.Set(fiber.HeaderETag, `W/"md5:`+resp.Record.ChecksumMD5+`"`)
		c.Set(fiber.HeaderCacheControl, "private, max-age=86400")
		return c.Send(resp.Record.Data)
	})
}
