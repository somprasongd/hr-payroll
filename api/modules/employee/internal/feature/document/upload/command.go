package upload

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/events"
)

const maxDocSizeBytes = 10 * 1024 * 1024 // 10MB

var allowedContentTypes = map[string]bool{
	"application/pdf": true,
	"image/jpeg":      true,
	"image/jpg":       true,
	"image/png":       true,
}

type Command struct {
	EmployeeID     uuid.UUID
	DocumentTypeID uuid.UUID
	FileName       string
	ContentType    string
	Data           []byte
	Size           int64
	DocumentNumber *string
	IssueDate      *time.Time
	ExpiryDate     *time.Time
	Notes          *string
}

type Response struct {
	ID             uuid.UUID  `json:"id"`
	FileName       string     `json:"fileName"`
	ContentType    string     `json:"contentType"`
	FileSizeBytes  int64      `json:"fileSizeBytes"`
	ChecksumMD5    string     `json:"checksumMd5"`
	DocumentNumber *string    `json:"documentNumber"`
	IssueDate      *time.Time `json:"issueDate"`
	ExpiryDate     *time.Time `json:"expiryDate"`
}

type Handler struct {
	repo repository.Repository
	eb   eventbus.EventBus
}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository, eb eventbus.EventBus) *Handler {
	return &Handler{repo: repo, eb: eb}
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing user context")
	}

	if len(cmd.Data) == 0 {
		return nil, errs.BadRequest("file is empty")
	}
	if cmd.Size > maxDocSizeBytes || int64(len(cmd.Data)) > maxDocSizeBytes {
		return nil, errs.BadRequest("file too large (max 10MB)")
	}
	if cmd.ContentType == "" || !allowedContentTypes[strings.ToLower(cmd.ContentType)] {
		return nil, errs.BadRequest("contentType must be application/pdf, image/jpeg, or image/png")
	}

	// Validate document type exists
	docType, err := h.repo.GetDocumentType(ctx, cmd.DocumentTypeID)
	if err != nil || docType == nil {
		return nil, errs.BadRequest("invalid document type")
	}

	// Compute checksum
	sum := md5.Sum(cmd.Data)
	checksum := hex.EncodeToString(sum[:])

	rec, err := h.repo.InsertDocument(ctx, repository.DocumentRecord{
		EmployeeID:     cmd.EmployeeID,
		DocumentTypeID: cmd.DocumentTypeID,
		FileName:       cmd.FileName,
		ContentType:    cmd.ContentType,
		FileSizeBytes:  cmd.Size,
		Data:           cmd.Data,
		ChecksumMD5:    checksum,
		DocumentNumber: cmd.DocumentNumber,
		IssueDate:      cmd.IssueDate,
		ExpiryDate:     cmd.ExpiryDate,
		Notes:          cmd.Notes,
	}, user.ID)
	if err != nil {
		if repository.IsUniqueViolation(err) {
			return nil, errs.Conflict("duplicate document (same file already uploaded for this employee)")
		}
		logger.FromContext(ctx).Error("failed to insert employee document", zap.Error(err))
		return nil, errs.Internal("failed to upload document")
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  &tenant.CompanyID,
		BranchID:   tenant.BranchIDPtr(),
		Action:     "UPLOAD",
		EntityName: "EMPLOYEE_DOCUMENT",
		EntityID:   rec.ID.String(),
		Details: map[string]interface{}{
			"employee_id":  rec.EmployeeID,
			"doc_type_id":  rec.DocumentTypeID,
			"file_name":    rec.FileName,
			"document_num": rec.DocumentNumber,
		},
		Timestamp: time.Now(),
	})

	return &Response{
		ID:             rec.ID,
		FileName:       rec.FileName,
		ContentType:    rec.ContentType,
		FileSizeBytes:  rec.FileSizeBytes,
		ChecksumMD5:    rec.ChecksumMD5,
		DocumentNumber: rec.DocumentNumber,
		IssueDate:      rec.IssueDate,
		ExpiryDate:     rec.ExpiryDate,
	}, nil
}
