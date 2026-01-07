package list

import (
	"context"

	"hrms/modules/masterdata/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"

	"go.uber.org/zap"
)

type Query struct {
	Only string
}

type Response struct {
	PersonTitles      []repository.MasterRecord `json:"personTitles,omitempty"`
	EmployeeTypes     []repository.MasterRecord `json:"employeeTypes,omitempty"`
	IDDocumentTypes   []repository.MasterRecord `json:"idDocumentTypes,omitempty"`
	Departments       []repository.MasterRecord `json:"departments,omitempty"`
	EmployeePositions []repository.MasterRecord `json:"employeePositions,omitempty"`
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

	// Get company ID from tenant context
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}
	companyID := tenant.CompanyID

	loadAll := q.Only == ""
	if loadAll || q.Only == "person_titles" {
		data, err := h.repo.PersonTitles(ctx)
		if err != nil {
			logger.FromContext(ctx).Error("failed to load person titles", zap.Error(err))
			return nil, err
		}
		resp.PersonTitles = data
	}
	if loadAll || q.Only == "employee_types" {
		data, err := h.repo.EmployeeTypes(ctx)
		if err != nil {
			logger.FromContext(ctx).Error("failed to load employee types", zap.Error(err))
			return nil, err
		}
		resp.EmployeeTypes = data
	}
	if loadAll || q.Only == "id_document_types" {
		data, err := h.repo.IDDocumentTypes(ctx)
		if err != nil {
			logger.FromContext(ctx).Error("failed to load ID document types", zap.Error(err))
			return nil, err
		}
		resp.IDDocumentTypes = data
	}
	if loadAll || q.Only == "departments" {
		data, err := h.repo.Departments(ctx, companyID)
		if err != nil {
			logger.FromContext(ctx).Error("failed to load departments", zap.Error(err))
			return nil, err
		}
		resp.Departments = data
	}
	if loadAll || q.Only == "employee_positions" {
		data, err := h.repo.EmployeePositions(ctx, companyID)
		if err != nil {
			logger.FromContext(ctx).Error("failed to load employee positions", zap.Error(err))
			return nil, err
		}
		resp.EmployeePositions = data
	}
	return resp, nil
}
