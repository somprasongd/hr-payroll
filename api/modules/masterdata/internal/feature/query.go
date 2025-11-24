package feature

import (
	"context"

	"hrms/modules/masterdata/internal/repository"
	"hrms/shared/common/mediator"
)

type Query struct {
	Only string
}

type Response struct {
	PersonTitles    []repository.MasterRecord `json:"personTitles,omitempty"`
	EmployeeTypes   []repository.MasterRecord `json:"employeeTypes,omitempty"`
	IDDocumentTypes []repository.MasterRecord `json:"idDocumentTypes,omitempty"`
}

type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*Query, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, q *Query) (*Response, error) {
	resp := &Response{}

	loadAll := q.Only == ""
	if loadAll || q.Only == "person_titles" {
		data, err := h.repo.PersonTitles(ctx)
		if err != nil {
			return nil, err
		}
		resp.PersonTitles = data
	}
	if loadAll || q.Only == "employee_types" {
		data, err := h.repo.EmployeeTypes(ctx)
		if err != nil {
			return nil, err
		}
		resp.EmployeeTypes = data
	}
	if loadAll || q.Only == "id_document_types" {
		data, err := h.repo.IDDocumentTypes(ctx)
		if err != nil {
			return nil, err
		}
		resp.IDDocumentTypes = data
	}
	return resp, nil
}
