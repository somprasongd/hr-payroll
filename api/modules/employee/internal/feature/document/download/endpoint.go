package download

import (
	"fmt"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

// Download employee document
// @Summary Download document file
// @Description ดาวน์โหลดไฟล์เอกสารพนักงาน
// @Tags Employee Documents
// @Produce application/octet-stream
// @Security BearerAuth
// @Param id path string true "Employee ID"
// @Param docId path string true "Document ID"
// @Success 200 {file} binary
// @Failure 401
// @Failure 404
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /employees/{id}/documents/{docId}/file [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/:docId/file", func(c fiber.Ctx) error {
		docID, err := uuid.Parse(c.Params("docId"))
		if err != nil {
			return errs.BadRequest("invalid document id")
		}

		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			DocumentID: docID,
		})
		if err != nil {
			return err
		}

		c.Set("Content-Type", resp.ContentType)
		c.Set("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", resp.FileName))
		c.Set("Content-Length", fmt.Sprintf("%d", resp.FileSizeBytes))
		c.Set("ETag", fmt.Sprintf("\"%s\"", resp.ChecksumMD5))
		c.Set("Cache-Control", "private, max-age=86400")

		return c.Send(resp.Data)
	})
}
