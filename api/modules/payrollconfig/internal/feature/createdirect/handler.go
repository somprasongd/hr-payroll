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
		HourlyRate:                 0,
		OtHourlyRate:               0,
		AttendanceBonusNoLate:      0,
		AttendanceBonusNoLeave:     0,
		HousingAllowance:           0,
		WaterRatePerUnit:           0,
		ElectricityRatePerUnit:     0,
		InternetFeeMonthly:         0,
		SocialSecurityRateEmployee: 0.05,
		SocialSecurityRateEmployer: 0.05,
		SocialSecurityWageCap:      17500,
		TaxApplyStandardExpense:    true,
		TaxStandardExpenseRate:     0.50,
		TaxStandardExpenseCap:      100000,
		TaxApplyPersonalAllowance:  true,
		TaxPersonalAllowanceAmount: 60000,
		TaxProgressiveBrackets:     defaultTaxProgressiveBrackets,
		WithholdingTaxRateService:  0.03,
	}
}

var defaultTaxProgressiveBrackets = repository.TaxBrackets{
	{Min: floatPtr(0), Max: floatPtr(150000), Rate: 0},
	{Min: floatPtr(150000), Max: floatPtr(300000), Rate: 0.05},
	{Min: floatPtr(300000), Max: floatPtr(500000), Rate: 0.10},
	{Min: floatPtr(500000), Max: floatPtr(750000), Rate: 0.15},
	{Min: floatPtr(750000), Max: floatPtr(1000000), Rate: 0.20},
	{Min: floatPtr(1000000), Max: floatPtr(2000000), Rate: 0.25},
	{Min: floatPtr(2000000), Max: floatPtr(5000000), Rate: 0.30},
	{Min: floatPtr(5000000), Max: nil, Rate: 0.35},
}

func floatPtr(v float64) *float64 {
	return &v
}
