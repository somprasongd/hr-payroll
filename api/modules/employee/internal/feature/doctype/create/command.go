package create

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
	"hrms/shared/events"
)

type Command struct {
	Code   string `json:"code"`
	NameTh string `json:"nameTh"`
	NameEn string `json:"nameEn"`
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
	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing user context")
	}

	code := strings.TrimSpace(cmd.Code)
	if code == "" {
		return nil, errs.BadRequest("code is required")
	}
	nameTh := strings.TrimSpace(cmd.NameTh)
	if nameTh == "" {
		return nil, errs.BadRequest("nameTh is required")
	}
	nameEn := strings.TrimSpace(cmd.NameEn)
	if nameEn == "" {
		return nil, errs.BadRequest("nameEn is required")
	}

	rec, err := h.repo.CreateDocumentType(ctx, repository.DocumentTypeRecord{
		Code:   code,
		NameTh: nameTh,
		NameEn: nameEn,
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
		Action:     "CREATE",
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
