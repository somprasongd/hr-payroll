package ft

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/worklog/internal/dto"
	"hrms/modules/worklog/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
	"hrms/shared/common/storage/sqldb/transactor"
)

type UpdateCommand struct {
	ID      uuid.UUID
	Payload UpdateRequest
	ActorID uuid.UUID
	Repo    repository.FTRepository
	Tx      transactor.Transactor
}

type UpdateResponse struct {
	dto.FTItem
}

type updateHandler struct{}

func NewUpdateHandler() *updateHandler { return &updateHandler{} }

type UpdateRequest struct {
	EntryType string    `json:"entryType"`
	WorkDate  time.Time `json:"workDate"`
	Quantity  float64   `json:"quantity"`
	Status    string    `json:"status"` // pending|approved
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
		logger.FromContext(ctx).Error("failed to load worklog", zap.Error(err))
		return nil, errs.Internal("failed to load worklog")
	}

	// only allow delete/update on pending; status transitions pending->approved allowed; approved cannot change status back
	if current.Status == "approved" && cmd.Payload.Status != "approved" {
		return nil, errs.BadRequest("cannot revert approved worklog")
	}

	rec := repository.FTRecord{
		EntryType: cmd.Payload.EntryType,
		WorkDate:  cmd.Payload.WorkDate,
		Quantity:  cmd.Payload.Quantity,
		Status:    cmd.Payload.Status,
		UpdatedBy: cmd.ActorID,
	}

	var updated *repository.FTRecord
	err = cmd.Tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		updated, err = cmd.Repo.Update(ctxTx, cmd.ID, rec)
		return err
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("worklog not found")
		}
		logger.FromContext(ctx).Error("failed to update worklog", zap.Error(err))
		return nil, errs.Internal("failed to update worklog")
	}

	return &UpdateResponse{FTItem: dto.FromFT(*updated)}, nil
}

func validateUpdatePayload(p UpdateRequest) error {
	if err := validateFTPayload(CreateRequest{
		EmployeeID: uuid.New(), // placeholder for validation of fields
		EntryType:  p.EntryType,
		WorkDate:   p.WorkDate,
		Quantity:   p.Quantity,
	}); err != nil {
		return err
	}
	p.Status = strings.TrimSpace(p.Status)
	if p.Status == "" {
		p.Status = "pending"
	}
	if p.Status != "pending" && p.Status != "approved" {
		return errs.BadRequest("invalid status")
	}
	return nil
}

// @Summary Update worklog FT
// @Description แก้ไข worklog (Full-time). เปลี่ยนสถานะเป็น approved ได้, revert approved ไม่ได้
// @Tags Worklogs FT
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
// @Router /worklogs/ft/{id} [patch]
func registerUpdate(router fiber.Router, repo repository.FTRepository, tx transactor.Transactor) {
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
		return response.JSON(c, fiber.StatusOK, resp.FTItem)
	})
}
