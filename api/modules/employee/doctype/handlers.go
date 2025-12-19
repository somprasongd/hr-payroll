// Package doctype provides handlers for system document type Commands/Queries
// These handlers are registered with the mediator for cross-module access.
package doctype

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/mediator"
	"hrms/shared/contracts"
	"hrms/shared/events"
)

// ListSystemHandler handles the list system document types query
type ListSystemHandler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*contracts.ListSystemDocTypesQuery, *contracts.ListSystemDocTypesResponse] = (*ListSystemHandler)(nil)

// NewListSystemHandler creates a new handler
func NewListSystemHandler(repo repository.Repository) *ListSystemHandler {
	return &ListSystemHandler{repo: repo}
}

// Handle processes the query
func (h *ListSystemHandler) Handle(ctx context.Context, q *contracts.ListSystemDocTypesQuery) (*contracts.ListSystemDocTypesResponse, error) {
	items, err := h.repo.ListSystemDocumentTypes(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]contracts.SystemDocType, len(items))
	for i, item := range items {
		result[i] = contracts.SystemDocType{
			ID:        item.ID,
			Code:      item.Code,
			NameTh:    item.NameTh,
			NameEn:    item.NameEn,
			IsSystem:  item.IsSystem,
			CompanyID: item.CompanyID,
		}
	}
	return &contracts.ListSystemDocTypesResponse{Items: result}, nil
}

// CreateSystemHandler handles the create system document type command
type CreateSystemHandler struct {
	repo repository.Repository
	eb   eventbus.EventBus
}

var _ mediator.RequestHandler[*contracts.CreateSystemDocTypeCommand, *contracts.CreateSystemDocTypeResponse] = (*CreateSystemHandler)(nil)

// NewCreateSystemHandler creates a new handler
func NewCreateSystemHandler(repo repository.Repository, eb eventbus.EventBus) *CreateSystemHandler {
	return &CreateSystemHandler{repo: repo, eb: eb}
}

// Handle processes the command
func (h *CreateSystemHandler) Handle(ctx context.Context, cmd *contracts.CreateSystemDocTypeCommand) (*contracts.CreateSystemDocTypeResponse, error) {
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

	rec, err := h.repo.CreateSystemDocumentType(ctx, repository.DocumentTypeRecord{
		Code:   code,
		NameTh: nameTh,
		NameEn: nameEn,
	}, cmd.ActorID)
	if err != nil {
		if repository.IsUniqueViolation(err) {
			return nil, errs.Conflict("document type code already exists")
		}
		return nil, err
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		Action:     "CREATE",
		EntityName: "SYSTEM_DOCUMENT_TYPE",
		EntityID:   rec.ID.String(),
		Details: map[string]interface{}{
			"code":      rec.Code,
			"name_th":   rec.NameTh,
			"name_en":   rec.NameEn,
			"is_system": true,
		},
		Timestamp: time.Now(),
	})

	return &contracts.CreateSystemDocTypeResponse{
		SystemDocType: contracts.SystemDocType{
			ID:       rec.ID,
			Code:     rec.Code,
			NameTh:   rec.NameTh,
			NameEn:   rec.NameEn,
			IsSystem: rec.IsSystem,
		},
	}, nil
}

// UpdateSystemHandler handles the update system document type command
type UpdateSystemHandler struct {
	repo repository.Repository
	eb   eventbus.EventBus
}

var _ mediator.RequestHandler[*contracts.UpdateSystemDocTypeCommand, *contracts.UpdateSystemDocTypeResponse] = (*UpdateSystemHandler)(nil)

// NewUpdateSystemHandler creates a new handler
func NewUpdateSystemHandler(repo repository.Repository, eb eventbus.EventBus) *UpdateSystemHandler {
	return &UpdateSystemHandler{repo: repo, eb: eb}
}

// Handle processes the command
func (h *UpdateSystemHandler) Handle(ctx context.Context, cmd *contracts.UpdateSystemDocTypeCommand) (*contracts.UpdateSystemDocTypeResponse, error) {
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

	rec, err := h.repo.UpdateSystemDocumentType(ctx, cmd.ID, repository.DocumentTypeRecord{
		Code:   code,
		NameTh: nameTh,
		NameEn: nameEn,
	}, cmd.ActorID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("document type not found or not a system type")
		}
		if repository.IsUniqueViolation(err) {
			return nil, errs.Conflict("document type code already exists")
		}
		return nil, err
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		Action:     "UPDATE",
		EntityName: "SYSTEM_DOCUMENT_TYPE",
		EntityID:   rec.ID.String(),
		Details: map[string]interface{}{
			"code":      rec.Code,
			"name_th":   rec.NameTh,
			"name_en":   rec.NameEn,
			"is_system": true,
		},
		Timestamp: time.Now(),
	})

	return &contracts.UpdateSystemDocTypeResponse{
		SystemDocType: contracts.SystemDocType{
			ID:       rec.ID,
			Code:     rec.Code,
			NameTh:   rec.NameTh,
			NameEn:   rec.NameEn,
			IsSystem: rec.IsSystem,
		},
	}, nil
}

// DeleteSystemHandler handles the delete system document type command
type DeleteSystemHandler struct {
	repo repository.Repository
	eb   eventbus.EventBus
}

var _ mediator.RequestHandler[*contracts.DeleteSystemDocTypeCommand, mediator.NoResponse] = (*DeleteSystemHandler)(nil)

// NewDeleteSystemHandler creates a new handler
func NewDeleteSystemHandler(repo repository.Repository, eb eventbus.EventBus) *DeleteSystemHandler {
	return &DeleteSystemHandler{repo: repo, eb: eb}
}

// Handle processes the command
func (h *DeleteSystemHandler) Handle(ctx context.Context, cmd *contracts.DeleteSystemDocTypeCommand) (mediator.NoResponse, error) {
	err := h.repo.SoftDeleteSystemDocumentType(ctx, cmd.ID, cmd.ActorID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return mediator.NoResponse{}, errs.NotFound("document type not found or not a system type")
		}
		return mediator.NoResponse{}, err
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		Action:     "DELETE",
		EntityName: "SYSTEM_DOCUMENT_TYPE",
		EntityID:   cmd.ID.String(),
		Details: map[string]interface{}{
			"is_system": true,
		},
		Timestamp: time.Now(),
	})

	return mediator.NoResponse{}, nil
}

// RegisterSystemHandlers registers system doctype handlers with mediator
func RegisterSystemHandlers(repo repository.Repository, eb eventbus.EventBus) {
	mediator.Register[*contracts.ListSystemDocTypesQuery, *contracts.ListSystemDocTypesResponse](NewListSystemHandler(repo))
	mediator.Register[*contracts.CreateSystemDocTypeCommand, *contracts.CreateSystemDocTypeResponse](NewCreateSystemHandler(repo, eb))
	mediator.Register[*contracts.UpdateSystemDocTypeCommand, *contracts.UpdateSystemDocTypeResponse](NewUpdateSystemHandler(repo, eb))
	mediator.Register[*contracts.DeleteSystemDocTypeCommand, mediator.NoResponse](NewDeleteSystemHandler(repo, eb))
}
