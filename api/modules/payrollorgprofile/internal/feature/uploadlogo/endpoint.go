package uploadlogo

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// Upload payroll org logo
// @Summary Upload payroll org logo
// @Description อัปโหลดไฟล์โลโก้ (image) เพื่อใช้อ้างอิงใน org profile
// @Tags Payroll Org Profile
// @Accept multipart/form-data
// @Produce json
// @Security BearerAuth
// @Param file formData file true "logo file (<=2MB)"
// @Success 201 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Router /admin/payroll-org-logos [post]
func NewEndpoint(router fiber.Router) {
	router.Post("/", func(c fiber.Ctx) error {
		fileHeader, err := c.FormFile("file")
		if err != nil {
			return errs.BadRequest("file is required")
		}

		if fileHeader.Size <= 0 {
			return errs.BadRequest("file is empty")
		}
		if fileHeader.Size > maxLogoSizeBytes {
			return errs.BadRequest("file too large (max 2MB)")
		}

		src, err := fileHeader.Open()
		if err != nil {
			return errs.BadRequest("cannot read file")
		}
		defer src.Close()

		var buf bytes.Buffer
		limited := io.LimitReader(src, maxLogoSizeBytes+1)
		if _, err := buf.ReadFrom(limited); err != nil {
			return errs.BadRequest("cannot read file")
		}
		if buf.Len() == 0 {
			return errs.BadRequest("file is empty")
		}
		if int64(buf.Len()) > maxLogoSizeBytes {
			return errs.BadRequest("file too large (max 2MB)")
		}

		contentType := detectContentType(fileHeader, buf.Bytes())
		if contentType == "" || !strings.HasPrefix(contentType, "image/") {
			return errs.BadRequest("contentType must be image/*")
		}

		fileName := strings.TrimSpace(fileHeader.Filename)
		if fileName == "" {
			fileName = "logo"
		}

		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			FileName:    fileName,
			ContentType: contentType,
			Data:        buf.Bytes(),
			Size:        int64(buf.Len()),
			ActorID:     user.ID,
		})
		if err != nil {
			return err
		}

		return response.JSON(c, fiber.StatusCreated, resp)
	})
}

func detectContentType(h *multipart.FileHeader, data []byte) string {
	if h != nil {
		if ct := h.Header.Get("Content-Type"); ct != "" {
			return ct
		}
	}
	return http.DetectContentType(data)
}
