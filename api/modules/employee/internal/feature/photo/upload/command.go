package upload

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"strings"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
)

const maxPhotoSizeBytes = 2 * 1024 * 1024

type Command struct {
	FileName    string
	ContentType string
	Data        []byte
	Size        int64
	ActorID     uuid.UUID
}

type Response struct {
	ID            uuid.UUID `json:"id"`
	FileName      string    `json:"fileName"`
	ContentType   string    `json:"contentType"`
	FileSizeBytes int64     `json:"fileSizeBytes"`
	ChecksumMD5   string    `json:"checksumMd5"`
}

type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	if len(cmd.Data) == 0 {
		return nil, errs.BadRequest("file is empty")
	}
	if cmd.Size > maxPhotoSizeBytes || int64(len(cmd.Data)) > maxPhotoSizeBytes {
		return nil, errs.BadRequest("file too large (max 2MB)")
	}
	if cmd.ContentType == "" || !strings.HasPrefix(cmd.ContentType, "image/") {
		return nil, errs.BadRequest("contentType must be image/*")
	}

	sum := md5.Sum(cmd.Data)
	checksum := hex.EncodeToString(sum[:])

	rec, err := h.repo.InsertPhoto(ctx, repository.PhotoRecord{
		FileName:      cmd.FileName,
		ContentType:   cmd.ContentType,
		FileSizeBytes: cmd.Size,
		Data:          cmd.Data,
		ChecksumMD5:   checksum,
		CreatedBy:     cmd.ActorID,
	})
	if err != nil {
		logger.FromContext(ctx).Error("failed to insert employee photo", zap.Error(err))
		return nil, errs.Internal("failed to upload photo")
	}

	return &Response{
		ID:            rec.ID,
		FileName:      rec.FileName,
		ContentType:   rec.ContentType,
		FileSizeBytes: rec.FileSizeBytes,
		ChecksumMD5:   rec.ChecksumMD5,
	}, nil
}
