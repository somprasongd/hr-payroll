package items

import (
	"context"
	"database/sql"
	"errors"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/payrollrun/internal/dto"
	"hrms/modules/payrollrun/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

type GetQuery struct {
	ID   uuid.UUID
	Repo repository.Repository
}

type GetResponse struct {
	dto.ItemDetail
}

type getHandler struct{}

func NewGetHandler() *getHandler { return &getHandler{} }

func (h *getHandler) Handle(ctx context.Context, q *GetQuery) (*GetResponse, error) {
	item, err := q.Repo.GetItemDetail(ctx, q.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("payroll item not found")
		}
		return nil, errs.Internal("failed to load payroll item")
	}
	return &GetResponse{ItemDetail: dto.FromItemDetail(*item)}, nil
}

// @Summary Get payroll item detail
// @Description ดูรายละเอียดสลิปพนักงาน
// @Tags Payroll Run
// @Produce json
// @Security BearerAuth
// @Param id path string true "item id"
// @Success 200 {object} GetResponse
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Router /payroll-items/{id} [get]
func RegisterGet(router fiber.Router, repo repository.Repository) {
	router.Get("/:itemId", func(c fiber.Ctx) error {
		itemID, err := uuid.Parse(c.Params("itemId"))
		if err != nil {
			return errs.BadRequest("invalid item id")
		}
		resp, err := mediator.Send[*GetQuery, *GetResponse](c.Context(), &GetQuery{
			ID:   itemID,
			Repo: repo,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.ItemDetail)
	})
}
