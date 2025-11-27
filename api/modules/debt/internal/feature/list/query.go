package list

import (
	"context"
	"math"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/debt/internal/dto"
	"hrms/modules/debt/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
)

type Query struct {
	Page       int
	Limit      int
	EmployeeID *uuid.UUID
	Type       string
	Status     string
	StartDate  *time.Time
	EndDate    *time.Time
}

type Response struct {
	Data []dto.Item `json:"data"`
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

	res, err := h.repo.List(ctx, q.Page, q.Limit, q.EmployeeID, q.Type, q.Status, q.StartDate, q.EndDate)
	if err != nil {
		logger.FromContext(ctx).Error("failed to list debt transactions", zap.Error(err))
		return nil, errs.Internal("failed to list debt transactions")
	}

	data := make([]dto.Item, 0, len(res.Rows))
	for _, r := range res.Rows {
		item := dto.FromRecord(r)
		if len(r.Installments) > 0 {
			item.Installments = make([]dto.Item, 0, len(r.Installments))
			for _, inst := range r.Installments {
				item.Installments = append(item.Installments, dto.FromRecord(inst))
			}
		}
		data = append(data, item)
	}
	totalPages := int(math.Ceil(float64(res.Total) / float64(q.Limit)))
	if totalPages == 0 {
		totalPages = 1
	}

	return &Response{
		Data: data,
		Meta: dto.Meta{
			CurrentPage: q.Page,
			TotalPages:  totalPages,
			TotalItems:  res.Total,
		},
	}, nil
}
