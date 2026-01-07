package pt

import (
	"context"
	"database/sql"
	"errors"
	"math"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/worklog/internal/dto"
	"hrms/modules/worklog/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
)

type ListQuery struct {
	Page       int
	Limit      int
	EmployeeID *uuid.UUID
	Status     string
	StartDate  *time.Time
	EndDate    *time.Time
	Repo       repository.PTRepository
}

type ListResponse struct {
	Data []dto.PTItem `json:"data"`
	Meta struct {
		CurrentPage int `json:"currentPage"`
		TotalPages  int `json:"totalPages"`
		TotalItems  int `json:"totalItems"`
	} `json:"meta"`
}

type listHandler struct{}

func NewListHandler() *listHandler { return &listHandler{} }

func (h *listHandler) Handle(ctx context.Context, q *ListQuery) (*ListResponse, error) {
	if q.Page < 1 {
		q.Page = 1
	}
	if q.Limit <= 0 || q.Limit > 1000 {
		q.Limit = 1000
	}

	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	res, err := q.Repo.List(ctx, tenant, q.Page, q.Limit, q.EmployeeID, q.Status, q.StartDate, q.EndDate)
	if err != nil {
		logger.FromContext(ctx).Error("failed to list worklogs", zap.Error(err))
		return nil, errs.Internal("failed to list worklogs")
	}
	var data []dto.PTItem
	for _, r := range res.Rows {
		data = append(data, dto.FromPT(r))
	}
	totalPages := int(math.Ceil(float64(res.Total) / float64(q.Limit)))
	if totalPages == 0 {
		totalPages = 1
	}
	resp := &ListResponse{Data: data}
	resp.Meta.CurrentPage = q.Page
	resp.Meta.TotalPages = totalPages
	resp.Meta.TotalItems = res.Total
	return resp, nil
}

type GetQuery struct {
	ID   uuid.UUID
	Repo repository.PTRepository
}

type GetResponse struct {
	dto.PTItem
}

type getHandler struct{}

func NewGetHandler() *getHandler { return &getHandler{} }

func (h *getHandler) Handle(ctx context.Context, q *GetQuery) (*GetResponse, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	rec, err := q.Repo.Get(ctx, tenant, q.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("worklog not found")
		}
		logger.FromContext(ctx).Error("failed to get worklog", zap.Error(err))
		return nil, errs.Internal("failed to get worklog")
	}
	return &GetResponse{PTItem: dto.FromPT(*rec)}, nil
}
