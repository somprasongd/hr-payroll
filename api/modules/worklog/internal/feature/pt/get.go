package pt

import (
	"context"
	"database/sql"
	"errors"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/worklog/internal/dto"
	"hrms/modules/worklog/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

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
	rec, err := q.Repo.Get(ctx, q.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("worklog not found")
		}
		return nil, errs.Internal("failed to get worklog")
	}
	return &GetResponse{PTItem: dto.FromPT(*rec)}, nil
}

// @Summary Get worklog PT detail
// @Description ดึง worklog (Part-time) ตาม id
// @Tags Worklogs PT
// @Produce json
// @Param id path string true "worklog id"
// @Security BearerAuth
// @Success 200 {object} GetResponse
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Router /worklogs/pt/{id} [get]
func registerGet(router fiber.Router, repo repository.PTRepository) {
	router.Get("/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}
		resp, err := mediator.Send[*GetQuery, *GetResponse](c.Context(), &GetQuery{
			ID:   id,
			Repo: repo,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.PTItem)
	})
}
