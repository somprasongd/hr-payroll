package ft

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
	EntryType  string
	StartDate  *time.Time
	EndDate    *time.Time
}

type ListResponse struct {
	Data []dto.FTItem `json:"data"`
	Meta struct {
		CurrentPage int `json:"currentPage"`
		TotalPages  int `json:"totalPages"`
		TotalItems  int `json:"totalItems"`
	} `json:"meta"`
}

type listHandler struct {
	repo repository.FTRepository
}

func NewListHandler(repo repository.FTRepository) *listHandler {
	return &listHandler{repo: repo}
}

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

	res, err := h.repo.List(ctx, tenant, q.Page, q.Limit, q.EmployeeID, q.Status, q.EntryType, q.StartDate, q.EndDate)
	if err != nil {
		logger.FromContext(ctx).Error("failed to list worklogs", zap.Error(err))
		return nil, errs.Internal("failed to list worklogs")
	}

	var data []dto.FTItem
	for _, r := range res.Rows {
		data = append(data, dto.FromFT(r))
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
	ID uuid.UUID
}

type GetResponse struct {
	dto.FTItem
}

type getHandler struct {
	repo repository.FTRepository
}

func NewGetHandler(repo repository.FTRepository) *getHandler {
	return &getHandler{repo: repo}
}

func (h *getHandler) Handle(ctx context.Context, q *GetQuery) (*GetResponse, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	rec, err := h.repo.Get(ctx, tenant, q.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("worklog not found")
		}
		logger.FromContext(ctx).Error("failed to get worklog", zap.Error(err))
		return nil, errs.Internal("failed to get worklog")
	}
	return &GetResponse{FTItem: dto.FromFT(*rec)}, nil
}
