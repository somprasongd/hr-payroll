package items

import (
	"context"
	"math"
	"strconv"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/payrollrun/internal/dto"
	"hrms/modules/payrollrun/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
	"hrms/shared/common/storage/sqldb/transactor"
)

type ListQuery struct {
	RunID  uuid.UUID
	Page   int
	Limit  int
	Search string
	Repo   repository.Repository
}

type ListResponse struct {
	Data []dto.Item `json:"data"`
	Meta dto.Meta   `json:"meta"`
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
	res, err := q.Repo.ListItems(ctx, q.RunID, q.Page, q.Limit, q.Search)
	if err != nil {
		logger.FromContext(ctx).Error("failed to list payroll items", zap.Error(err))
		return nil, errs.Internal("failed to list payroll items")
	}
	var data []dto.Item
	for _, it := range res.Rows {
		data = append(data, dto.FromItem(it))
	}
	totalPages := int(math.Ceil(float64(res.Total) / float64(q.Limit)))
	if totalPages == 0 {
		totalPages = 1
	}
	return &ListResponse{
		Data: data,
		Meta: dto.Meta{
			CurrentPage: q.Page,
			TotalPages:  totalPages,
			TotalItems:  res.Total,
		},
	}, nil
}

// @Summary List payroll items
// @Description รายการสลิปเงินเดือนใน run
// @Tags Payroll Run
// @Produce json
// @Param id path string true "run id"
// @Param page query int false "page"
// @Param limit query int false "limit"
// @Param search query string false "employee name"
// @Security BearerAuth
// @Success 200 {object} ListResponse
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Router /payroll-runs/{id}/items [get]
func Register(runRouter fiber.Router, itemRouter fiber.Router, repo repository.Repository, tx transactor.Transactor) {
	runRouter.Get("/:id/items", func(c fiber.Ctx) error {
		runID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid run id")
		}
		page, _ := strconv.Atoi(c.Query("page", "1"))
		limit, _ := strconv.Atoi(c.Query("limit", "20"))
		search := c.Query("search")

		resp, err := mediator.Send[*ListQuery, *ListResponse](c.Context(), &ListQuery{
			RunID:  runID,
			Page:   page,
			Limit:  limit,
			Search: search,
			Repo:   repo,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})

	RegisterUpdateItem(itemRouter, repo, tx)
	RegisterGet(itemRouter, repo)
}
