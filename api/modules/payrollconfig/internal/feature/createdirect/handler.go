package createdirect

import (
	"context"
	"time"

	"go.uber.org/zap"

	"hrms/modules/payrollconfig/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/contracts"
	"hrms/shared/events"
)

type Handler struct {
	repo repository.Repository
	eb   eventbus.EventBus
}

var _ mediator.RequestHandler[*contracts.CreatePayrollConfigDirectCommand, *contracts.CreatePayrollConfigDirectResponse] = (*Handler)(nil)

func NewHandler(repo repository.Repository, eb eventbus.EventBus) *Handler {
	return &Handler{
		repo: repo,
		eb:   eb,
	}
}

func (h *Handler) Handle(ctx context.Context, cmd *contracts.CreatePayrollConfigDirectCommand) (*contracts.CreatePayrollConfigDirectResponse, error) {
	payload := buildDefaultPayrollConfig(cmd.StartDate)

	created, err := h.repo.Create(ctx, payload, cmd.CompanyID, cmd.ActorID)
	if err != nil {
		logger.FromContext(ctx).Error("failed to create payroll config (direct)", zap.Error(err), zap.String("company_id", cmd.CompanyID.String()))
		return nil, errs.Internal("failed to create payroll config")
	}

	h.eb.Publish(events.LogEvent{
		ActorID:    cmd.ActorID,
		CompanyID:  &cmd.CompanyID,
		Action:     "CREATE",
		EntityName: "PAYROLL_CONFIG",
		EntityID:   created.ID.String(),
		Details: map[string]interface{}{
			"effective_date":                created.StartDate.Format("2006-01-02"),
			"status":                        created.Status,
			"social_security_rate_employee": created.SocialSecurityRateEmployee,
			"social_security_rate_employer": created.SocialSecurityRateEmployer,
			"social_security_wage_cap":      created.SocialSecurityWageCap,
			"created_via":                   "company_creation",
		},
		Timestamp: time.Now(),
	})

	return &contracts.CreatePayrollConfigDirectResponse{
		ID: created.ID,
	}, nil
}

// buildDefaultPayrollConfig creates the default payroll config record
func buildDefaultPayrollConfig(startDate time.Time) repository.Record {
	return repository.Record{
		StartDate:                  startDate,
		HourlyRate:                 70.00,
		OtHourlyRate:               70.00,
		AttendanceBonusNoLate:      500.00,
		AttendanceBonusNoLeave:     1000.00,
		HousingAllowance:           1000.00,
		WaterRatePerUnit:           10.00,
		ElectricityRatePerUnit:     6.00,
		InternetFeeMonthly:         80.00,
		SocialSecurityRateEmployee: 0.05,
		SocialSecurityRateEmployer: 0.05,
		SocialSecurityWageCap:      17500.00,
		TaxApplyStandardExpense:    true,
		TaxStandardExpenseRate:     0.50,
		TaxStandardExpenseCap:      100000.00,
		TaxApplyPersonalAllowance:  true,
		TaxPersonalAllowanceAmount: 60000.00,
		TaxProgressiveBrackets:     defaultTaxProgressiveBrackets,
		WithholdingTaxRateService:  0.03,
		WorkHoursPerDay:            8.00,
		LateRatePerMinute:          5.00,
		LateGraceMinutes:           15,
	}
}

var defaultTaxProgressiveBrackets = repository.TaxBrackets{
	{Min: floatPtr(0), Max: floatPtr(150000), Rate: 0},
	{Min: floatPtr(150001), Max: floatPtr(300000), Rate: 0.05},
	{Min: floatPtr(300001), Max: floatPtr(500000), Rate: 0.10},
	{Min: floatPtr(500001), Max: floatPtr(750000), Rate: 0.15},
	{Min: floatPtr(750001), Max: floatPtr(1000000), Rate: 0.20},
	{Min: floatPtr(1000001), Max: floatPtr(2000000), Rate: 0.25},
	{Min: floatPtr(2000001), Max: floatPtr(5000000), Rate: 0.30},
	{Min: floatPtr(5000001), Max: nil, Rate: 0.35},
}

func floatPtr(v float64) *float64 {
	return &v
}
