package ft

import (
	"context"
	"math"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/worklog/internal/dto"
	"hrms/modules/worklog/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
	"hrms/shared/common/storage/sqldb/transactor"
)

type ListQuery struct {
	Page       int
	Limit      int
	EmployeeID *uuid.UUID
	Status     string
	EntryType  string
	StartDate  *time.Time
	EndDate    *time.Time
	Repo       repository.FTRepository
}

type ListResponse struct {
	Data []dto.FTItem `json:"data"`
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
	if q.Limit <= 0 || q.Limit > 100 {
		q.Limit = 20
	}

	res, err := q.Repo.List(ctx, q.Page, q.Limit, q.EmployeeID, q.Status, q.EntryType, q.StartDate, q.EndDate)
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

// Register list endpoint
// @Summary List worklogs FT
// @Description รายการ worklog (Full-time)
// @Tags Worklogs FT
// @Produce json
// @Param page query int false "page"
// @Param limit query int false "limit"
// @Param employeeId query string false "employee id"
// @Param status query string false "pending|approved|all"
// @Param entryType query string false "late|leave_day|leave_double|leave_hours|ot"
// @Param startDate query string false "YYYY-MM-DD"
// @Param endDate query string false "YYYY-MM-DD"
// @Security BearerAuth
// @Success 200 {object} ListResponse
// @Failure 400
// @Failure 401
// @Failure 403
// @Router /worklogs/ft [get]
func Register(router fiber.Router, repo repository.FTRepository, tx transactor.Transactor) {
	router.Get("/", func(c fiber.Ctx) error {
		page, _ := strconv.Atoi(c.Query("page", "1"))
		limit, _ := strconv.Atoi(c.Query("limit", "20"))
		status := c.Query("status", "pending")
		entryType := c.Query("entryType")
		var empID *uuid.UUID
		if v := c.Query("employeeId"); v != "" {
			if id, err := uuid.Parse(v); err == nil {
				empID = &id
			} else {
				return errs.BadRequest("invalid employeeId")
			}
		}
		var startDate, endDate *time.Time
		if v := c.Query("startDate"); v != "" {
			d, err := time.Parse("2006-01-02", v)
			if err != nil {
				return errs.BadRequest("invalid startDate")
			}
			startDate = &d
		}
		if v := c.Query("endDate"); v != "" {
			d, err := time.Parse("2006-01-02", v)
			if err != nil {
				return errs.BadRequest("invalid endDate")
			}
			endDate = &d
		}

		resp, err := mediator.Send[*ListQuery, *ListResponse](c.Context(), &ListQuery{
			Page:       page,
			Limit:      limit,
			EmployeeID: empID,
			Status:     status,
			EntryType:  entryType,
			StartDate:  startDate,
			EndDate:    endDate,
			Repo:       repo,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})

	// register detail/create/update/delete
	registerGet(router, repo)
	registerCreate(router, repo, tx)
	registerUpdate(router, repo, tx)
	registerDelete(router, repo)
}
