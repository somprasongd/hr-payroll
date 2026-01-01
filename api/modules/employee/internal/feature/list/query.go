package list

import (
	"context"
	"math"
	"strings"

	"hrms/modules/employee/internal/dto"
	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"

	"go.uber.org/zap"
)

type Query struct {
	Page               int
	Limit              int
	Search             string
	Status             string
	EmployeeTypeID     string
	EmployeeTypeCode   string
	HasOutstandingDebt bool
}

type Response struct {
	Data []dto.ListItem `json:"data"`
	Meta dto.Meta       `json:"meta"`
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
	q.Status = strings.TrimSpace(q.Status)
	if q.Status == "" {
		q.Status = "all"
	}
	q.EmployeeTypeID = strings.TrimSpace(q.EmployeeTypeID)
	q.EmployeeTypeCode = strings.TrimSpace(strings.ToLower(q.EmployeeTypeCode))

	if q.EmployeeTypeID == "" && q.EmployeeTypeCode != "" {
		switch q.EmployeeTypeCode {
		case "ft":
			q.EmployeeTypeCode = "full_time"
		case "pt":
			q.EmployeeTypeCode = "part_time"
		}
		id, err := h.repo.FindEmployeeTypeIDByCode(ctx, q.EmployeeTypeCode)
		if err != nil {
			logger.FromContext(ctx).Error("failed to resolve employee type code", zap.Error(err))
			return nil, errs.Internal("failed to list employees")
		}
		if id == nil {
			return nil, errs.BadRequest("invalid employeeTypeCode")
		}
		q.EmployeeTypeID = id.String()
	}

	res, err := h.repo.List(ctx, q.Page, q.Limit, q.Search, q.Status, q.EmployeeTypeID, q.HasOutstandingDebt)
	if err != nil {
		logger.FromContext(ctx).Error("failed to list employees", zap.Error(err))
		return nil, errs.Internal("failed to list employees")
	}

	var data []dto.ListItem
	for _, r := range res.Rows {
		data = append(data, dto.FromListRecord(r))
	}
	if data == nil {
		data = make([]dto.ListItem, 0)
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
