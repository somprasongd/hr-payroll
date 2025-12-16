package pt

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
	Repo    repository.PTRepository
	Tx      transactor.Transactor
	Eb      eventbus.EventBus
}

type UpdateResponse struct {
	dto.PTItem
}

type updateHandler struct{}

func NewUpdateHandler() *updateHandler { return &updateHandler{} }

type UpdateRequest struct {
	WorkDate   string  `json:"workDate"`
	MorningIn  *string `json:"morningIn"`
	MorningOut *string `json:"morningOut"`
	EveningIn  *string `json:"eveningIn"`
	EveningOut *string `json:"eveningOut"`
	Status     string  `json:"status"` // pending|approved
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

	parsedDate, morningIn, morningOut, eveningIn, eveningOut, status, err := normalizeUpdatePayload(&cmd.Payload, current)
	if err != nil {
		return nil, err
	}

	if current.Status == "approved" && status != "approved" {
		return nil, errs.BadRequest("cannot revert approved worklog")
	}

	rec := repository.PTRecord{
		WorkDate:   parsedDate,
		MorningIn:  morningIn,
		MorningOut: morningOut,
		EveningIn:  eveningIn,
		EveningOut: eveningOut,
		Status:     status,
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
		logger.FromContext(ctx).Error("failed to update worklog", zap.Error(err))
		return nil, errs.Internal("failed to update worklog")
	}

	details := map[string]interface{}{}
	if !parsedDate.Equal(current.WorkDate) {
		details["work_date"] = parsedDate.Format("2006-01-02")
	}
	if morningIn != current.MorningIn {
		details["morning_in"] = morningIn
	}
	if morningOut != current.MorningOut {
		details["morning_out"] = morningOut
	}
	if eveningIn != current.EveningIn {
		details["evening_in"] = eveningIn
	}
	if eveningOut != current.EveningOut {
		details["evening_out"] = eveningOut
	}
	if status != current.Status {
		details["status"] = status
	}

	cmd.Eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		Action:     "UPDATE",
		EntityName: "WORKLOG_PT",
		EntityID:   updated.ID.String(),
		Details:    details,
		Timestamp:  time.Now(),
	})

	return &UpdateResponse{PTItem: dto.FromPT(*updated)}, nil
}

func normalizeUpdatePayload(p *UpdateRequest, current *repository.PTRecord) (time.Time, *string, *string, *string, *string, string, error) {
	// work date (fallback to current)
	var workDate time.Time
	if strings.TrimSpace(p.WorkDate) == "" {
		workDate = current.WorkDate
	} else {
		d, err := time.Parse("2006-01-02", strings.TrimSpace(p.WorkDate))
		if err != nil {
			return time.Time{}, nil, nil, nil, nil, "", errs.BadRequest("workDate must be YYYY-MM-DD")
		}
		workDate = d
	}

	// time fields: keep current if nil; empty string means clear
	parseTime := func(val *string, currentVal *string, field string) (*string, error) {
		if val == nil {
			return currentVal, nil
		}
		trimmed := strings.TrimSpace(*val)
		if trimmed == "" {
			return nil, nil
		}
		if _, err := time.Parse("15:04", trimmed); err != nil {
			return nil, errs.BadRequest(field + " must be HH:MM")
		}
		return &trimmed, nil
	}

	mIn, err := parseTime(p.MorningIn, current.MorningIn, "morningIn")
	if err != nil {
		return time.Time{}, nil, nil, nil, nil, "", err
	}
	mOut, err := parseTime(p.MorningOut, current.MorningOut, "morningOut")
	if err != nil {
		return time.Time{}, nil, nil, nil, nil, "", err
	}
	eIn, err := parseTime(p.EveningIn, current.EveningIn, "eveningIn")
	if err != nil {
		return time.Time{}, nil, nil, nil, nil, "", err
	}
	eOut, err := parseTime(p.EveningOut, current.EveningOut, "eveningOut")
	if err != nil {
		return time.Time{}, nil, nil, nil, nil, "", err
	}

	status := strings.TrimSpace(p.Status)
	if status == "" {
		status = current.Status
	}
	if status != "pending" && status != "approved" {
		return time.Time{}, nil, nil, nil, nil, "", errs.BadRequest("invalid status")
	}

	return workDate, mIn, mOut, eIn, eOut, status, nil
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
func registerUpdate(router fiber.Router, repo repository.PTRepository, tx transactor.Transactor, eb eventbus.EventBus) {
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
		return response.JSON(c, fiber.StatusOK, resp.PTItem)
	})
}
