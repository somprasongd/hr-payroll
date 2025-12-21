package superadminlist

import (
	"context"

	"go.uber.org/zap"

	"hrms/modules/activitylog/internal/entity"
	"hrms/modules/activitylog/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
)

type Query struct {
	Repo     *repository.Repository
	Page     int
	Limit    int
	Action   string
	Entity   string
	FromDate string
	ToDate   string
	UserName string
}

type Meta struct {
	Page  int `json:"page"`
	Limit int `json:"limit"`
	Total int `json:"total"`
}

type Response struct {
	Data []entity.ActivityLog `json:"data"`
	Meta Meta                 `json:"meta"`
}

type queryHandler struct{}

func NewHandler() *queryHandler {
	return &queryHandler{}
}

func (h *queryHandler) Handle(ctx context.Context, q *Query) (*Response, error) {
	filter := repository.ListFilter{
		Action:   q.Action,
		Entity:   q.Entity,
		FromDate: q.FromDate,
		ToDate:   q.ToDate,
		UserName: q.UserName,
	}

	logs, total, err := q.Repo.ListSystemLogs(ctx, filter, q.Page, q.Limit)
	if err != nil {
		logger.FromContext(ctx).Error("failed to list system activity logs", zap.Error(err))
		return nil, errs.Internal("failed to list activity logs")
	}

	return &Response{
		Data: logs,
		Meta: Meta{
			Page:  q.Page,
			Limit: q.Limit,
			Total: total,
		},
	}, nil
}
