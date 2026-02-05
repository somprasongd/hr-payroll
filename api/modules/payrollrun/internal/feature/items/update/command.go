package itemsupdate

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/payrollrun/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/events"
)

type UpdateCommand struct {
	ID      uuid.UUID `json:"-"`
	Payload UpdateRequest
}

type UpdateResponse struct {
	Item *repository.Item `json:"item"`
}

type updateHandler struct {
	repo repository.Repository
	tx   transactor.Transactor
	eb   eventbus.EventBus
}

func NewUpdateHandler(repo repository.Repository, tx transactor.Transactor, eb eventbus.EventBus) *updateHandler {
	return &updateHandler{
		repo: repo,
		tx:   tx,
		eb:   eb,
	}
}

type UpdateRequest struct {
	SalaryAmount            *float64                  `json:"salaryAmount"`
	OtHours                 *float64                  `json:"otHours"`
	OtAmount                *float64                  `json:"otAmount"`
	BonusAmount             *float64                  `json:"bonusAmount"`
	LeaveCompensationAmount *float64                  `json:"leaveCompensationAmount"`
	OthersIncome            *[]map[string]interface{} `json:"othersIncome"`
	OthersDeduction         *[]map[string]interface{} `json:"othersDeduction"`
	LoanRepayments          *[]map[string]interface{} `json:"loanRepayments"`
	LateMinutesQty          *int                      `json:"lateMinutesQty"`
	LateMinutesDeduction    *float64                  `json:"lateMinutesDeduction"`
	TaxMonthAmount          *float64                  `json:"taxMonthAmount"`
	SsoMonthAmount          *float64                  `json:"ssoMonthAmount"`
	PfMonthAmount           *float64                  `json:"pfMonthAmount"`
	AdvanceRepayAmount      *float64                  `json:"advanceRepayAmount"`
	WaterMeterPrev          *float64                  `json:"waterMeterPrev"`
	WaterMeterCurr          *float64                  `json:"waterMeterCurr"`
	WaterAmount             *float64                  `json:"waterAmount"`
	ElectricMeterPrev       *float64                  `json:"electricMeterPrev"`
	ElectricMeterCurr       *float64                  `json:"electricMeterCurr"`
	ElectricAmount          *float64                  `json:"electricAmount"`
	InternetAmount          *float64                  `json:"internetAmount"`
	DoctorFee               *float64                  `json:"doctorFee"`
}

func (h *updateHandler) Handle(ctx context.Context, cmd *UpdateCommand) (*UpdateResponse, error) {
	tenant, ok := contextx.TenantFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing tenant context")
	}

	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return nil, errs.Unauthorized("missing user context")
	}

	itemDetail, err := h.repo.GetItemDetail(ctx, tenant, cmd.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("payroll item not found")
		}
		return nil, errs.Internal("failed to load payroll item")
	}
	item := &itemDetail.Item
	// ensure parent run pending
	run, err := h.repo.Get(ctx, tenant, item.RunID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to load payroll run", zap.Error(err))
		return nil, errs.Internal("failed to load run for item")
	}
	if run.Status != "pending" {
		return nil, errs.BadRequest("only pending run can be adjusted")
	}

	// Validate employee settings to prevent overriding disabled benefits/deductions.
	if !item.AllowWater && (cmd.Payload.WaterMeterPrev != nil || cmd.Payload.WaterMeterCurr != nil || cmd.Payload.WaterAmount != nil) {
		return nil, errs.Conflict("water charges are not allowed for this employee")
	}
	if !item.AllowElectric && (cmd.Payload.ElectricMeterPrev != nil || cmd.Payload.ElectricMeterCurr != nil || cmd.Payload.ElectricAmount != nil) {
		return nil, errs.Conflict("electricity charges are not allowed for this employee")
	}
	if !item.AllowInternet && cmd.Payload.InternetAmount != nil {
		return nil, errs.Conflict("internet charges are not allowed for this employee")
	}
	if !item.AllowDoctorFee && cmd.Payload.DoctorFee != nil {
		return nil, errs.Conflict("doctor fee is not allowed for this employee")
	}
	if !item.SsoContribute && cmd.Payload.SsoMonthAmount != nil {
		return nil, errs.Conflict("social security contribution is disabled for this employee")
	}
	if !item.ProvidentFundContrib && cmd.Payload.PfMonthAmount != nil {
		return nil, errs.Conflict("provident fund contribution is disabled for this employee")
	}
	if !item.WithholdTax && cmd.Payload.TaxMonthAmount != nil {
		return nil, errs.Conflict("withhold tax is disabled for this employee")
	}

	// Business rules
	// Allow updating existing advance repay, but block adding new ones when advance amount is 0
	hasExistingAdvanceRepay := itemDetail.AdvanceRepayAmount > 0
	if itemDetail.AdvanceAmount == 0 && !hasExistingAdvanceRepay && cmd.Payload.AdvanceRepayAmount != nil && *cmd.Payload.AdvanceRepayAmount > 0 {
		return nil, errs.BadRequest("cannot repay advance when advanceAmount is 0")
	}
	// Allow updating existing loan repayments, but block adding new ones when outstanding is 0
	hasExistingLoanRepayments := len(itemDetail.LoanRepayments) > 0
	if itemDetail.LoanOutstandingTotal <= 0 && !hasExistingLoanRepayments && cmd.Payload.LoanRepayments != nil && len(*cmd.Payload.LoanRepayments) > 0 {
		return nil, errs.BadRequest("cannot repay loan when outstanding is 0")
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
	if cmd.Payload.LeaveCompensationAmount != nil {
		fields["leave_compensation_amount"] = *cmd.Payload.LeaveCompensationAmount
	}
	if cmd.Payload.OthersIncome != nil {
		bytes, _ := json.Marshal(cmd.Payload.OthersIncome)
		fields["others_income"] = bytes
	}
	if cmd.Payload.OthersDeduction != nil {
		bytes, _ := json.Marshal(cmd.Payload.OthersDeduction)
		fields["others_deduction"] = bytes
	}
	if cmd.Payload.LoanRepayments != nil {
		bytes, _ := json.Marshal(cmd.Payload.LoanRepayments)
		fields["loan_repayments"] = bytes
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
	if cmd.Payload.PfMonthAmount != nil {
		fields["pf_month_amount"] = *cmd.Payload.PfMonthAmount
	}
	if cmd.Payload.AdvanceRepayAmount != nil {
		fields["advance_repay_amount"] = *cmd.Payload.AdvanceRepayAmount
	}
	if cmd.Payload.WaterMeterPrev != nil {
		fields["water_meter_prev"] = *cmd.Payload.WaterMeterPrev
	}
	if cmd.Payload.WaterMeterCurr != nil {
		fields["water_meter_curr"] = *cmd.Payload.WaterMeterCurr
	}
	if cmd.Payload.WaterAmount != nil {
		fields["water_amount"] = *cmd.Payload.WaterAmount
	}
	if cmd.Payload.ElectricMeterPrev != nil {
		fields["electric_meter_prev"] = *cmd.Payload.ElectricMeterPrev
	}
	if cmd.Payload.ElectricMeterCurr != nil {
		fields["electric_meter_curr"] = *cmd.Payload.ElectricMeterCurr
	}
	if cmd.Payload.ElectricAmount != nil {
		fields["electric_amount"] = *cmd.Payload.ElectricAmount
	}
	if cmd.Payload.InternetAmount != nil {
		fields["internet_amount"] = *cmd.Payload.InternetAmount
	}
	if cmd.Payload.DoctorFee != nil {
		fields["doctor_fee"] = *cmd.Payload.DoctorFee
	}

	// [FIX] Set manual flags to true ONLY if value has changed AND not already manual
	if !itemDetail.IsManualTax && cmd.Payload.TaxMonthAmount != nil && *cmd.Payload.TaxMonthAmount != itemDetail.TaxMonthAmount {
		fields["is_manual_tax"] = true
	}
	if !itemDetail.IsManualPf && cmd.Payload.PfMonthAmount != nil && *cmd.Payload.PfMonthAmount != itemDetail.PFMonthAmount {
		fields["is_manual_pf"] = true
	}
	if !itemDetail.IsManualInternet && cmd.Payload.InternetAmount != nil && *cmd.Payload.InternetAmount != itemDetail.InternetAmount {
		fields["is_manual_internet"] = true
	}
	if !itemDetail.IsManualWater && cmd.Payload.WaterAmount != nil && *cmd.Payload.WaterAmount != itemDetail.WaterAmount {
		fields["is_manual_water"] = true
	}
	if !itemDetail.IsManualElectric && cmd.Payload.ElectricAmount != nil && *cmd.Payload.ElectricAmount != itemDetail.ElectricAmount {
		fields["is_manual_electric"] = true
	}
	if len(fields) == 0 {
		return nil, errs.BadRequest("no fields to update")
	}

	var updated *repository.Item
	if err := h.tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		updated, err = h.repo.UpdateItem(ctxTx, tenant, cmd.ID, user.ID, fields)
		return err
	}); err != nil {
		logger.FromContext(ctx).Error("failed to update payroll item", zap.Error(err))
		return nil, errs.Internal("failed to update payroll item")
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  &tenant.CompanyID,
		BranchID:   tenant.BranchIDPtr(),
		Action:     "UPDATE_ITEM",
		EntityName: "PAYROLL_RUN_ITEM",
		EntityID:   updated.ID.String(),
		Details:    fields,
		Timestamp:  time.Now(),
	})

	return &UpdateResponse{Item: updated}, nil
}
