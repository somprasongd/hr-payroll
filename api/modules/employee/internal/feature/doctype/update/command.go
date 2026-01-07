package update

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/mediator"
	"hrms/shared/common/validator"
	"hrms/shared/events"
)

type Command struct {
	ID     uuid.UUID `json:"-" validate:"required"`
	Code   string    `json:"code" validate:"required"`
	NameTh string    `json:"nameTh" validate:"required"`
	NameEn string    `json:"nameEn" validate:"required"`
}

type Response struct {
	repository.DocumentTypeRecord
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
	cmd.Code = strings.TrimSpace(cmd.Code)
	cmd.NameTh = strings.TrimSpace(cmd.NameTh)
	cmd.NameEn = strings.TrimSpace(cmd.NameEn)

	if err := validator.Validate(cmd); err != nil {
		return nil, err
	}

	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing user context")
	}

	rec, err := h.repo.UpdateDocumentType(ctx, cmd.ID, repository.DocumentTypeRecord{
		Code:   cmd.Code,
		NameTh: cmd.NameTh,
		NameEn: cmd.NameEn,
	}, user.ID)
	if err != nil {
		if repository.IsUniqueViolation(err) {
			return nil, errs.Conflict("document type code already exists")
		}
		return nil, err
	}

	// Get company ID from tenant context (nil if superadmin)
	var companyID *uuid.UUID
	if tenant, ok := contextx.TenantFromContext(ctx); ok {
		companyID = &tenant.CompanyID
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  companyID,
		BranchID:   nil,
		Action:     "UPDATE",
		EntityName: "DOCUMENT_TYPE",
		EntityID:   rec.ID.String(),
		Details: map[string]interface{}{
			"code":    rec.Code,
			"name_th": rec.NameTh,
			"name_en": rec.NameEn,
		},
		Timestamp: time.Now(),
	})

	return &Response{DocumentTypeRecord: *rec}, nil
}
