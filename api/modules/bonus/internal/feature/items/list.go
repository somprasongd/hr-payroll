package items

import (
	"context"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/bonus/internal/dto"
	"hrms/modules/bonus/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

type ListQuery struct {
	CycleID uuid.UUID
	Search  string
}

type ListResponse struct {
	Data []dto.Item `json:"data"`
}

type listHandler struct {
	repo repository.Repository
}

func NewListHandler(repo repository.Repository) *listHandler { return &listHandler{repo: repo} }

func (h *listHandler) Handle(ctx context.Context, q *ListQuery) (*ListResponse, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	items, err := h.repo.ListItems(ctx, tenant, q.CycleID, q.Search)
	if err != nil {
		logger.FromContext(ctx).Error("failed to list bonus items", zap.Error(err))
		return nil, errs.Internal("failed to list bonus items")
	}
	var out []dto.Item
	for _, it := range items {
		out = append(out, dto.FromItem(it))
	}
	return &ListResponse{Data: out}, nil
}

// @Summary List bonus items
// @Tags Bonus
// @Produce json
// @Security BearerAuth
// @Param id path string true "cycle id"
// @Param search query string false "search employee name"
// @Success 200 {object} ListResponse
// @Router /bonus-cycles/{id}/items [get]
func RegisterList(router fiber.Router) {
	router.Get("/:id/items", func(c fiber.Ctx) error {
		cycleID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid cycle id")
		}
		search := c.Query("search")
		resp, err := mediator.Send[*ListQuery, *ListResponse](c.Context(), &ListQuery{
			CycleID: cycleID,
			Search:  search,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
