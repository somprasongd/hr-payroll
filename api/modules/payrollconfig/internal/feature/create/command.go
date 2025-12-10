package create

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/payrollconfig/internal/dto"
	"hrms/modules/payrollconfig/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/mediator"
	"hrms/shared/common/storage/sqldb/transactor"
)

type Command struct {
	Payload RequestBody
	ActorID uuid.UUID
}

type Response struct {
	dto.Config
}

type Handler struct {
	repo repository.Repository
	tx   transactor.Transactor
}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository, tx transactor.Transactor) *Handler {
	return &Handler{
		repo: repo,
		tx:   tx,
	}
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	applyDefaults(&cmd.Payload)

	if err := validatePayload(cmd.Payload); err != nil {
		return nil, err
	}

	recPayload := cmd.Payload.ToRecord()

	var created *repository.Record
	err := h.tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		created, err = h.repo.Create(ctxTx, recPayload, cmd.ActorID)
		return err
	})
	if err != nil {
		logger.FromContext(ctx).Error("failed to create payroll config", zap.Error(err))
		return nil, errs.Internal("failed to create payroll config")
	}

	return &Response{Config: dto.FromRecord(*created)}, nil
}

func validatePayload(p RequestBody) error {
	if p.ParsedStartDate.IsZero() {
		return errs.BadRequest("startDate is required (YYYY-MM-DD)")
	}
	if p.HourlyRate <= 0 || p.OtHourlyRate <= 0 {
		return errs.BadRequest("hourlyRate and otHourlyRate must be positive")
	}
	if p.SocialSecurityRateEmployee < 0 || p.SocialSecurityRateEmployer < 0 {
		return errs.BadRequest("social security rates must be positive")
	}
	if p.SocialSecurityWageCap <= 0 {
		return errs.BadRequest("socialSecurityWageCap must be positive")
	}
	if p.TaxApplyStandardExpense == nil {
		return errs.BadRequest("taxApplyStandardExpense is required")
	}
	if p.TaxStandardExpenseRate == nil || *p.TaxStandardExpenseRate < 0 || *p.TaxStandardExpenseRate > 1 {
		return errs.BadRequest("taxStandardExpenseRate must be between 0 and 1")
	}
	if p.TaxStandardExpenseCap == nil || *p.TaxStandardExpenseCap < 0 {
		return errs.BadRequest("taxStandardExpenseCap must be zero or positive")
	}
	if p.TaxApplyPersonalAllowance == nil {
		return errs.BadRequest("taxApplyPersonalAllowance is required")
	}
	if p.TaxPersonalAllowanceAmount == nil || *p.TaxPersonalAllowanceAmount < 0 {
		return errs.BadRequest("taxPersonalAllowanceAmount must be zero or positive")
	}
	if len(p.TaxProgressiveBrackets) == 0 {
		return errs.BadRequest("taxProgressiveBrackets must be a non-empty array")
	}
	for i, b := range p.TaxProgressiveBrackets {
		if b.Min == nil {
			return errs.BadRequest(fmt.Sprintf("taxProgressiveBrackets[%d].min is required", i))
		}
		if *b.Min < 0 {
			return errs.BadRequest(fmt.Sprintf("taxProgressiveBrackets[%d].min must be zero or positive", i))
		}
		if b.Max != nil && *b.Max < 0 {
			return errs.BadRequest(fmt.Sprintf("taxProgressiveBrackets[%d].max must be zero or positive", i))
		}
		if b.Max != nil && *b.Max <= *b.Min {
			return errs.BadRequest(fmt.Sprintf("taxProgressiveBrackets[%d].max must be greater than min", i))
		}
		if b.Rate < 0 || b.Rate > 1 {
			return errs.BadRequest(fmt.Sprintf("taxProgressiveBrackets[%d].rate must be between 0 and 1", i))
		}
	}
	if p.WithholdingTaxRateService == nil || *p.WithholdingTaxRateService < 0 || *p.WithholdingTaxRateService > 1 {
		return errs.BadRequest("withholdingTaxRateService must be between 0 and 1")
	}
	return nil
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

const (
	defaultTaxStandardExpenseRate     = 0.50
	defaultTaxStandardExpenseCap      = 10000.00
	defaultTaxPersonalAllowanceAmount = 60000.00
	defaultWithholdingTaxRateService  = 0.03
	defaultSocialSecurityWageCap      = 15000.00
)

func applyDefaults(p *RequestBody) {
	if p.SocialSecurityWageCap <= 0 {
		p.SocialSecurityWageCap = defaultSocialSecurityWageCap
	}
	if p.TaxApplyStandardExpense == nil {
		v := true
		p.TaxApplyStandardExpense = &v
	}
	if p.TaxStandardExpenseRate == nil {
		v := defaultTaxStandardExpenseRate
		p.TaxStandardExpenseRate = &v
	}
	if p.TaxStandardExpenseCap == nil {
		v := defaultTaxStandardExpenseCap
		p.TaxStandardExpenseCap = &v
	}
	if p.TaxApplyPersonalAllowance == nil {
		v := true
		p.TaxApplyPersonalAllowance = &v
	}
	if p.TaxPersonalAllowanceAmount == nil {
		v := defaultTaxPersonalAllowanceAmount
		p.TaxPersonalAllowanceAmount = &v
	}
	if len(p.TaxProgressiveBrackets) == 0 {
		p.TaxProgressiveBrackets = defaultTaxProgressiveBrackets
	}
	if p.WithholdingTaxRateService == nil {
		v := defaultWithholdingTaxRateService
		p.WithholdingTaxRateService = &v
	}
}

func floatPtr(v float64) *float64 {
	return &v
}
