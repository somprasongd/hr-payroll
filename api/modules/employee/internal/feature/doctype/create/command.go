package create

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

type Command struct {
	Code    string    `json:"code"`
	NameTh  string    `json:"nameTh"`
	NameEn  string    `json:"nameEn"`
	ActorID uuid.UUID `json:"-"`
}

type Response struct {
	repository.DocumentTypeRecord
}

type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
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
	}, cmd.ActorID)
	if err != nil {
		if repository.IsUniqueViolation(err) {
			return nil, errs.Conflict("document type code already exists")
		}
		return nil, err
	}
	return &Response{DocumentTypeRecord: *rec}, nil
}
