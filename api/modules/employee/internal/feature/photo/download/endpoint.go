package download

import (
	"strconv"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/contextx"
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
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /employees/photos/{id} [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/:id", func(c fiber.Ctx) error {
		idStr := c.Params("id")
		id, err := uuid.Parse(idStr)
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		tenant, ok := contextx.TenantFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing tenant context")
		}

		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			ID:        id,
			CompanyID: tenant.CompanyID,
		})
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
