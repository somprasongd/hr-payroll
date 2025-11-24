package pt

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/worklog/internal/dto"
	"hrms/modules/worklog/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
	"hrms/shared/common/storage/sqldb/transactor"
)

type UpdateCommand struct {
	ID      uuid.UUID
	Payload UpdateRequest
	ActorID uuid.UUID
	Repo    repository.PTRepository
	Tx      transactor.Transactor
}

type UpdateResponse struct {
	dto.PTItem
}

type updateHandler struct{}

func NewUpdateHandler() *updateHandler { return &updateHandler{} }

type UpdateRequest struct {
	WorkDate   time.Time `json:"workDate"`
	MorningIn  *string   `json:"morningIn"`
	MorningOut *string   `json:"morningOut"`
	EveningIn  *string   `json:"eveningIn"`
	EveningOut *string   `json:"eveningOut"`
	Status     string    `json:"status"` // pending|approved
}

func (h *updateHandler) Handle(ctx context.Context, cmd *UpdateCommand) (*UpdateResponse, error) {
	if err := validateUpdatePayload(cmd.Payload); err != nil {
		return nil, err
	}

	current, err := cmd.Repo.Get(ctx, cmd.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("worklog not found")
		}
		return nil, errs.Internal("failed to load worklog")
	}
	if current.Status == "approved" && cmd.Payload.Status != "approved" {
		return nil, errs.BadRequest("cannot revert approved worklog")
	}

	rec := repository.PTRecord{
		WorkDate:   cmd.Payload.WorkDate,
		MorningIn:  cmd.Payload.MorningIn,
		MorningOut: cmd.Payload.MorningOut,
		EveningIn:  cmd.Payload.EveningIn,
		EveningOut: cmd.Payload.EveningOut,
		Status:     cmd.Payload.Status,
		UpdatedBy:  cmd.ActorID,
	}

	var updated *repository.PTRecord
	err = cmd.Tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		updated, err = cmd.Repo.Update(ctxTx, cmd.ID, rec)
		return err
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("worklog not found")
		}
		return nil, errs.Internal("failed to update worklog")
	}

	return &UpdateResponse{PTItem: dto.FromPT(*updated)}, nil
}

func validateUpdatePayload(p UpdateRequest) error {
	tmp := CreateRequest{
		EmployeeID: uuid.New(), // bypass employee validation
		WorkDate:   p.WorkDate,
		MorningIn:  p.MorningIn,
		MorningOut: p.MorningOut,
		EveningIn:  p.EveningIn,
		EveningOut: p.EveningOut,
		Status:     p.Status,
	}
	return validatePayload(tmp)
}

// @Summary Update worklog PT
// @Description แก้ไข worklog (Part-time). เปลี่ยนสถานะเป็น approved ได้, revert approved ไม่ได้
// @Tags Worklogs PT
// @Accept json
// @Produce json
// @Param id path string true "worklog id"
// @Param request body UpdateRequest true "worklog payload"
// @Security BearerAuth
// @Success 200 {object} UpdateResponse
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Router /worklogs/pt/{id} [patch]
func registerUpdate(router fiber.Router, repo repository.PTRepository, tx transactor.Transactor) {
	router.Patch("/:id", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}
		var req UpdateRequest
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		resp, err := mediator.Send[*UpdateCommand, *UpdateResponse](c.Context(), &UpdateCommand{
			ID:      id,
			Payload: req,
			ActorID: user.ID,
			Repo:    repo,
			Tx:      tx,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.PTItem)
	})
}
