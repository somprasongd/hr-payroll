package items

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/payrollrun/internal/dto"
	"hrms/modules/payrollrun/internal/repository"
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
	Repo    repository.Repository
	Tx      transactor.Transactor
}

type UpdateResponse struct {
	dto.Item
}

type updateHandler struct{}

func NewUpdateHandler() *updateHandler { return &updateHandler{} }

type UpdateRequest struct {
	SalaryAmount *float64 `json:"salaryAmount"`
	OtHours      *float64 `json:"otHours"`
	OtAmount     *float64 `json:"otAmount"`
	BonusAmount  *float64 `json:"bonusAmount"`
	OthersIncome *[]struct {
		Description string  `json:"description"`
		Value       float64 `json:"value"`
	} `json:"othersIncome"`
	LateMinutesQty       *int     `json:"lateMinutesQty"`
	LateMinutesDeduction *float64 `json:"lateMinutesDeduction"`
	TaxMonthAmount       *float64 `json:"taxMonthAmount"`
	SsoMonthAmount       *float64 `json:"ssoMonthAmount"`
}

func (h *updateHandler) Handle(ctx context.Context, cmd *UpdateCommand) (*UpdateResponse, error) {
	item, err := cmd.Repo.GetItem(ctx, cmd.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("payroll item not found")
		}
		logger.FromContext(ctx).Error("failed to load payroll item", zap.Error(err))
		return nil, errs.Internal("failed to load payroll item")
	}
	// ensure parent run pending
	run, err := cmd.Repo.Get(ctx, item.RunID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to load payroll run", zap.Error(err))
		return nil, errs.Internal("failed to load run for item")
	}
	if run.Status != "pending" {
		return nil, errs.BadRequest("can adjust items only when run is pending")
	}

	fields := map[string]interface{}{}
	if cmd.Payload.SalaryAmount != nil {
		fields["salary_amount"] = *cmd.Payload.SalaryAmount
	}
	if cmd.Payload.OtHours != nil {
		fields["ot_hours"] = *cmd.Payload.OtHours
	}
	if cmd.Payload.OtAmount != nil {
		fields["ot_amount"] = *cmd.Payload.OtAmount
	}
	if cmd.Payload.BonusAmount != nil {
		fields["bonus_amount"] = *cmd.Payload.BonusAmount
	}
	if cmd.Payload.OthersIncome != nil {
		bytes, _ := json.Marshal(cmd.Payload.OthersIncome)
		fields["others_income"] = bytes
	}
	if cmd.Payload.LateMinutesQty != nil {
		fields["late_minutes_qty"] = *cmd.Payload.LateMinutesQty
	}
	if cmd.Payload.LateMinutesDeduction != nil {
		fields["late_minutes_deduction"] = *cmd.Payload.LateMinutesDeduction
	}
	if cmd.Payload.TaxMonthAmount != nil {
		fields["tax_month_amount"] = *cmd.Payload.TaxMonthAmount
	}
	if cmd.Payload.SsoMonthAmount != nil {
		fields["sso_month_amount"] = *cmd.Payload.SsoMonthAmount
	}
	if len(fields) == 0 {
		return nil, errs.BadRequest("no fields to update")
	}

	var updated *repository.Item
	if err := cmd.Tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		updated, err = cmd.Repo.UpdateItem(ctxTx, cmd.ID, cmd.ActorID, fields)
		return err
	}); err != nil {
		logger.FromContext(ctx).Error("failed to update payroll item", zap.Error(err))
		return nil, errs.Internal("failed to update payroll item")
	}

	return &UpdateResponse{Item: dto.FromItem(*updated)}, nil
}

// @Summary Adjust payroll item
// @Description แก้ไขยอดในสลิป (เฉพาะรันที่ไม่ approved)
// @Tags Payroll Run
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "item id"
// @Param request body UpdateRequest true "payload"
// @Success 200 {object} UpdateResponse
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Router /payroll-items/{id} [patch]
func RegisterUpdateItem(router fiber.Router, repo repository.Repository, tx transactor.Transactor) {
	router.Patch("/:itemId", func(c fiber.Ctx) error {
		itemID, err := uuid.Parse(c.Params("itemId"))
		if err != nil {
			return errs.BadRequest("invalid item id")
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
			ID:      itemID,
			Payload: req,
			ActorID: user.ID,
			Repo:    repo,
			Tx:      tx,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Item)
	})
}
