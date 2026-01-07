package update

import (
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

type requestBody struct {
	DocumentTypeID string  `json:"documentTypeId"`
	DocumentNumber *string `json:"documentNumber"`
	IssueDate      *string `json:"issueDate"`
	ExpiryDate     *string `json:"expiryDate"`
	Notes          *string `json:"notes"`
}

// Update employee document
// @Summary Update document metadata
// @Description อัปเดตข้อมูลเอกสารพนักงาน (ไม่รวมไฟล์)
// @Tags Employee Documents
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Employee ID"
// @Param docId path string true "Document ID"
// @Param body body requestBody true "payload"
// @Success 200 {object} Response
// @Failure 400
// @Failure 401
// @Failure 404
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /employees/{id}/documents/{docId} [put]
func NewEndpoint(router fiber.Router) {
	router.Put("/:docId", func(c fiber.Ctx) error {
		docID, err := uuid.Parse(c.Params("docId"))
		if err != nil {
			return errs.BadRequest("invalid document id")
		}

		var body requestBody
		if err := c.Bind().JSON(&body); err != nil {
			return errs.BadRequest("invalid request body")
		}

		documentTypeID, err := uuid.Parse(body.DocumentTypeID)
		if err != nil {
			return errs.BadRequest("invalid documentTypeId")
		}

		var issueDate *time.Time
		if body.IssueDate != nil && *body.IssueDate != "" {
			if t, err := time.Parse("2006-01-02", *body.IssueDate); err == nil {
				issueDate = &t
			}
		}

		var expiryDate *time.Time
		if body.ExpiryDate != nil && *body.ExpiryDate != "" {
			if t, err := time.Parse("2006-01-02", *body.ExpiryDate); err == nil {
				expiryDate = &t
			}
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			DocumentID:     docID,
			DocumentTypeID: documentTypeID,
			DocumentNumber: body.DocumentNumber,
			IssueDate:      issueDate,
			ExpiryDate:     expiryDate,
			Notes:          body.Notes,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
