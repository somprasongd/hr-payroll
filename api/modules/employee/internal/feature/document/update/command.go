package update

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"

	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/mediator"
	"hrms/shared/events"
)

type Command struct {
	DocumentID     uuid.UUID
	DocumentTypeID uuid.UUID
	DocumentNumber *string
	IssueDate      *time.Time
	ExpiryDate     *time.Time
	Notes          *string
	ActorID        uuid.UUID
}

type Response struct {
	repository.DocumentRecord
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
	// Validate document type exists
	docType, err := h.repo.GetDocumentType(ctx, cmd.DocumentTypeID)
	if err != nil || docType == nil {
		return nil, errs.BadRequest("invalid document type")
	}

	rec, err := h.repo.UpdateDocument(ctx, cmd.DocumentID, repository.DocumentRecord{
		DocumentTypeID: cmd.DocumentTypeID,
		DocumentNumber: cmd.DocumentNumber,
		IssueDate:      cmd.IssueDate,
		ExpiryDate:     cmd.ExpiryDate,
		Notes:          cmd.Notes,
	}, cmd.ActorID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("document not found")
		}
		return nil, err
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		Action:     "UPDATE",
		EntityName: "EMPLOYEE_DOCUMENT",
		EntityID:   rec.ID.String(),
		Details: map[string]interface{}{
			"doc_type_id":  rec.DocumentTypeID,
			"document_num": rec.DocumentNumber,
		},
		Timestamp: time.Now(),
	})

	return &Response{DocumentRecord: *rec}, nil
}
