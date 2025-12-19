// Package contracts provides shared Command/Query types for cross-module mediator communication.
// Modules should depend on this package instead of depending on each other directly.
package contracts

import "github.com/google/uuid"

// ===== System Document Type Commands/Queries =====

// ListSystemDocTypesQuery for listing system document types
type ListSystemDocTypesQuery struct{}

// SystemDocType represents a system document type
type SystemDocType struct {
	ID        uuid.UUID  `json:"id"`
	Code      string     `json:"code"`
	NameTh    string     `json:"nameTh"`
	NameEn    string     `json:"nameEn"`
	IsSystem  bool       `json:"isSystem"`
	CompanyID *uuid.UUID `json:"companyId,omitempty"`
}

// ListSystemDocTypesResponse contains list of system document types
type ListSystemDocTypesResponse struct {
	Items []SystemDocType `json:"items"`
}

// CreateSystemDocTypeCommand for creating a system document type
type CreateSystemDocTypeCommand struct {
	Code    string    `json:"code"`
	NameTh  string    `json:"nameTh"`
	NameEn  string    `json:"nameEn"`
	ActorID uuid.UUID `json:"-"`
}

// CreateSystemDocTypeResponse contains the created document type
type CreateSystemDocTypeResponse struct {
	SystemDocType
}

// UpdateSystemDocTypeCommand for updating a system document type
type UpdateSystemDocTypeCommand struct {
	ID      uuid.UUID `json:"-"`
	Code    string    `json:"code"`
	NameTh  string    `json:"nameTh"`
	NameEn  string    `json:"nameEn"`
	ActorID uuid.UUID `json:"-"`
}

// UpdateSystemDocTypeResponse contains the updated document type
type UpdateSystemDocTypeResponse struct {
	SystemDocType
}

// DeleteSystemDocTypeCommand for deleting a system document type
type DeleteSystemDocTypeCommand struct {
	ID      uuid.UUID `json:"-"`
	ActorID uuid.UUID `json:"-"`
}
