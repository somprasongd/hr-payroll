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
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/events"
)

type UpdateCommand struct {
	ID      uuid.UUID
	Payload UpdateRequest
	ActorID uuid.UUID
	Repo    repository.FTRepository
	Tx      transactor.Transactor
	Eb      eventbus.EventBus
}

type UpdateResponse struct {
	dto.FTItem
}

type updateHandler struct{}

func NewUpdateHandler() *updateHandler { return &updateHandler{} }

type UpdateRequest struct {
	EntryType string   `json:"entryType"`
	WorkDate  string   `json:"workDate"`
	Quantity  *float64 `json:"quantity"`
	Status    string   `json:"status"` // pending|approved
}

func (h *updateHandler) Handle(ctx context.Context, cmd *UpdateCommand) (*UpdateResponse, error) {
	current, err := cmd.Repo.Get(ctx, cmd.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("worklog not found")
		}
		logger.FromContext(ctx).Error("failed to load worklog", zap.Error(err))
		return nil, errs.Internal("failed to load worklog")
	}

	entryType, workDate, quantity, status, err := normalizeUpdatePayload(&cmd.Payload, current)
	if err != nil {
		return nil, err
	}

	// only allow delete/update on pending; status transitions pending->approved allowed; approved cannot change status back
	if current.Status == "approved" && status != "approved" {
		return nil, errs.BadRequest("cannot revert approved worklog")
	}

	rec := repository.FTRecord{
		EntryType: entryType,
		WorkDate:  workDate,
		Quantity:  quantity,
		Status:    status,
		UpdatedBy: cmd.ActorID,
	}

	var updated *repository.FTRecord
	err = cmd.Tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		if entryType != current.EntryType || !workDate.Equal(current.WorkDate) {
			exists, err := cmd.Repo.ExistsActiveByEmployeeDateType(ctxTx, current.EmployeeID, workDate, entryType, &cmd.ID)
			if err != nil {
				return err
			}
			if exists {
				return errs.Conflict("worklog already exists for this employee, date, and entryType")
			}
		}

		updated, err = cmd.Repo.Update(ctxTx, cmd.ID, rec)
		if err != nil {
			if repository.IsUniqueErrFT(err) {
				return errs.Conflict("worklog already exists for this employee, date, and entryType")
			}
			return err
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("worklog not found")
		}
		var appErr *errs.AppError
		if errors.As(err, &appErr) {
			logger.FromContext(ctx).Warn("failed to update worklog", zap.Error(err))
			return nil, err
		}
		logger.FromContext(ctx).Error("failed to update worklog", zap.Error(err))
		return nil, errs.Internal("failed to update worklog")
	}

	details := map[string]interface{}{}
	if entryType != current.EntryType {
		details["entry_type"] = entryType
	}
	if !workDate.Equal(current.WorkDate) {
		details["work_date"] = workDate.Format("2006-01-02")
	}
	if quantity != current.Quantity {
		details["quantity"] = quantity
	}
	if status != current.Status {
		details["status"] = status
	}

	cmd.Eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		Action:     "UPDATE",
		EntityName: "WORKLOG_FT",
		EntityID:   updated.ID.String(),
		Details:    details,
		Timestamp:  time.Now(),
	})

	return &UpdateResponse{FTItem: dto.FromFT(*updated)}, nil
}

func normalizeUpdatePayload(p *UpdateRequest, current *repository.FTRecord) (string, time.Time, float64, string, error) {
	entryType := strings.TrimSpace(p.EntryType)
	if entryType == "" {
		entryType = current.EntryType
	} else {
		switch entryType {
		case "late", "leave_day", "leave_double", "leave_hours", "ot":
		default:
			return "", time.Time{}, 0, "", errs.BadRequest("invalid entryType")
		}
	}

	var workDate time.Time
	if strings.TrimSpace(p.WorkDate) == "" {
		workDate = current.WorkDate
	} else {
		parsedDate, err := time.Parse("2006-01-02", strings.TrimSpace(p.WorkDate))
		if err != nil {
			return "", time.Time{}, 0, "", errs.BadRequest("workDate must be YYYY-MM-DD")
		}
		workDate = parsedDate
	}

	var quantity float64
	if p.Quantity == nil {
		quantity = current.Quantity
	} else {
		if *p.Quantity <= 0 {
			return "", time.Time{}, 0, "", errs.BadRequest("quantity must be > 0")
		}
		quantity = *p.Quantity
	}

	status := strings.TrimSpace(p.Status)
	if status == "" {
		status = current.Status
	}
	if status != "pending" && status != "approved" {
		return "", time.Time{}, 0, "", errs.BadRequest("invalid status")
	}

	return entryType, workDate, quantity, status, nil
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
// @Failure 409
// @Router /worklogs/ft/{id} [patch]
func registerUpdate(router fiber.Router, repo repository.FTRepository, tx transactor.Transactor, eb eventbus.EventBus) {
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
			Eb:      eb,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.FTItem)
	})
}
