package upload

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// Upload employee document
// @Summary Upload document for employee
// @Description อัปโหลดเอกสารพนักงาน (PDF, JPG, PNG <= 10MB)
// @Tags Employee Documents
// @Accept multipart/form-data
// @Produce json
// @Security BearerAuth
// @Param id path string true "Employee ID"
// @Param file formData file true "Document file (<=10MB)"
// @Param documentTypeId formData string true "Document Type ID"
// @Param documentNumber formData string false "Document number"
// @Param issueDate formData string false "Issue date (YYYY-MM-DD)"
// @Param expiryDate formData string false "Expiry date (YYYY-MM-DD)"
// @Param notes formData string false "Notes"
// @Success 201 {object} Response
// @Failure 400
// @Failure 401
// @Failure 409
// @Router /employees/{id}/documents [post]
func NewEndpoint(router fiber.Router) {
	router.Post("/", func(c fiber.Ctx) error {
		employeeID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid employee id")
		}

		fileHeader, err := c.FormFile("file")
		if err != nil {
			return errs.BadRequest("file is required")
		}

		if fileHeader.Size <= 0 {
			return errs.BadRequest("file is empty")
		}
		if fileHeader.Size > maxDocSizeBytes {
			return errs.BadRequest("file too large (max 10MB)")
		}

		src, err := fileHeader.Open()
		if err != nil {
			return errs.BadRequest("cannot read file")
		}
		defer src.Close()

		var buf bytes.Buffer
		limited := io.LimitReader(src, maxDocSizeBytes+1)
		if _, err := buf.ReadFrom(limited); err != nil {
			return errs.BadRequest("cannot read file")
		}
		if buf.Len() == 0 {
			return errs.BadRequest("file is empty")
		}
		if int64(buf.Len()) > maxDocSizeBytes {
			return errs.BadRequest("file too large (max 10MB)")
		}

		contentType := detectContentType(fileHeader, buf.Bytes())
		if !allowedContentTypes[strings.ToLower(contentType)] {
			return errs.BadRequest("contentType must be application/pdf, image/jpeg, or image/png")
		}

		// Parse document type ID
		docTypeIDStr := c.FormValue("documentTypeId")
		if docTypeIDStr == "" {
			return errs.BadRequest("documentTypeId is required")
		}
		documentTypeID, err := uuid.Parse(docTypeIDStr)
		if err != nil {
			return errs.BadRequest("invalid documentTypeId")
		}

		fileName := strings.TrimSpace(fileHeader.Filename)
		if fileName == "" {
			fileName = "document"
		}

		// Parse optional fields
		var documentNumber *string
		if dn := c.FormValue("documentNumber"); dn != "" {
			documentNumber = &dn
		}

		var issueDate *time.Time
		if id := c.FormValue("issueDate"); id != "" {
			if t, err := time.Parse("2006-01-02", id); err == nil {
				issueDate = &t
			}
		}

		var expiryDate *time.Time
		if ed := c.FormValue("expiryDate"); ed != "" {
			if t, err := time.Parse("2006-01-02", ed); err == nil {
				expiryDate = &t
			}
		}

		var notes *string
		if n := c.FormValue("notes"); n != "" {
			notes = &n
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			EmployeeID:     employeeID,
			DocumentTypeID: documentTypeID,
			FileName:       fileName,
			ContentType:    contentType,
			Data:           buf.Bytes(),
			Size:           int64(buf.Len()),
			DocumentNumber: documentNumber,
			IssueDate:      issueDate,
			ExpiryDate:     expiryDate,
			Notes:          notes,
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
