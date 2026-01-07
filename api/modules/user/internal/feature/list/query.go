package list

import (
	"context"
	"math"
	"strings"

	"hrms/modules/user/internal/dto"
	"hrms/modules/user/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

type Query struct {
	Page      int
	Limit     int
	Role      string
	CompanyID uuid.UUID
}

type Response struct {
	Data []dto.User `json:"data"`
	Meta dto.Meta   `json:"meta"`
}

type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*Query, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, q *Query) (*Response, error) {
	if q.Page < 1 {
		q.Page = 1
	}
	if q.Limit <= 0 || q.Limit > 1000 {
		q.Limit = 1000
	}
	q.Role = strings.TrimSpace(q.Role)

	result, err := h.repo.ListUsers(ctx, q.Page, q.Limit, q.Role, q.CompanyID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to list users", zap.Error(err))
		return nil, errs.Internal("failed to list users")
	}

	var data []dto.User
	for _, u := range result.Users {
		data = append(data, dto.FromRecord(u))
	}
	totalPages := int(math.Ceil(float64(result.Total) / float64(q.Limit)))
	if totalPages == 0 {
		totalPages = 1
	}

	return &Response{
		Data: data,
		Meta: dto.Meta{
			CurrentPage: q.Page,
			TotalPages:  totalPages,
			TotalItems:  result.Total,
		},
	}, nil
}
