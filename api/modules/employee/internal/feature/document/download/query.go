package download

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"

	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

type Query struct {
	DocumentID uuid.UUID
}

type Response struct {
	FileName      string
	ContentType   string
	FileSizeBytes int64
	Data          []byte
	ChecksumMD5   string
}

type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*Query, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, q *Query) (*Response, error) {
	rec, err := h.repo.GetDocumentWithData(ctx, q.DocumentID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("document not found")
		}
		return nil, err
	}

	return &Response{
		FileName:      rec.FileName,
		ContentType:   rec.ContentType,
		FileSizeBytes: rec.FileSizeBytes,
		Data:          rec.Data,
		ChecksumMD5:   rec.ChecksumMD5,
	}, nil
}
