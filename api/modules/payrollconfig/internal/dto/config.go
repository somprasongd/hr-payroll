package dto

import (
	"time"

	"github.com/google/uuid"

	"hrms/modules/payrollconfig/internal/repository"
)

type Config struct {
	ID                         uuid.UUID              `json:"id"`
	VersionNo                  int64                  `json:"versionNo"`
	StartDate                  string                 `json:"startDate"`
	EndDate                    *string                `json:"endDate,omitempty"`
	Status                     string                 `json:"status"`
	HourlyRate                 float64                `json:"hourlyRate"`
	OtHourlyRate               float64                `json:"otHourlyRate"`
	AttendanceBonusNoLate      float64                `json:"attendanceBonusNoLate"`
	AttendanceBonusNoLeave     float64                `json:"attendanceBonusNoLeave"`
	HousingAllowance           float64                `json:"housingAllowance"`
	WaterRatePerUnit           float64                `json:"waterRatePerUnit"`
	ElectricityRatePerUnit     float64                `json:"electricityRatePerUnit"`
	InternetFeeMonthly         float64                `json:"internetFeeMonthly"`
	SocialSecurityRateEmployee float64                `json:"socialSecurityRateEmployee"`
	SocialSecurityRateEmployer float64                `json:"socialSecurityRateEmployer"`
	SocialSecurityWageCap      float64                `json:"socialSecurityWageCap"`
	TaxApplyStandardExpense    bool                   `json:"taxApplyStandardExpense"`
	TaxStandardExpenseRate     float64                `json:"taxStandardExpenseRate"`
	TaxStandardExpenseCap      float64                `json:"taxStandardExpenseCap"`
	TaxApplyPersonalAllowance  bool                   `json:"taxApplyPersonalAllowance"`
	TaxPersonalAllowanceAmount float64                `json:"taxPersonalAllowanceAmount"`
	TaxProgressiveBrackets     repository.TaxBrackets `json:"taxProgressiveBrackets"`
	WithholdingTaxRateService  float64                `json:"withholdingTaxRateService"`
	Note                       *string                `json:"note,omitempty"`
	CreatedAt                  time.Time              `json:"createdAt"`
	UpdatedAt                  time.Time              `json:"updatedAt"`
}

type Meta struct {
	CurrentPage int `json:"currentPage"`
	TotalPages  int `json:"totalPages"`
	TotalItems  int `json:"totalItems"`
}

func FromRecord(r repository.Record) Config {
	const dateFmt = "2006-01-02"

	var endDateStr *string
	if r.EndDate != nil {
		val := r.EndDate.Format(dateFmt)
		endDateStr = &val
	}

	return Config{
		ID:                         r.ID,
		VersionNo:                  r.VersionNo,
		StartDate:                  r.StartDate.Format(dateFmt),
		EndDate:                    endDateStr,
		Status:                     r.Status,
		HourlyRate:                 r.HourlyRate,
		OtHourlyRate:               r.OtHourlyRate,
		AttendanceBonusNoLate:      r.AttendanceBonusNoLate,
		AttendanceBonusNoLeave:     r.AttendanceBonusNoLeave,
		HousingAllowance:           r.HousingAllowance,
		WaterRatePerUnit:           r.WaterRatePerUnit,
		ElectricityRatePerUnit:     r.ElectricityRatePerUnit,
		InternetFeeMonthly:         r.InternetFeeMonthly,
		SocialSecurityRateEmployee: r.SocialSecurityRateEmployee,
		SocialSecurityRateEmployer: r.SocialSecurityRateEmployer,
		SocialSecurityWageCap:      r.SocialSecurityWageCap,
		TaxApplyStandardExpense:    r.TaxApplyStandardExpense,
		TaxStandardExpenseRate:     r.TaxStandardExpenseRate,
		TaxStandardExpenseCap:      r.TaxStandardExpenseCap,
		TaxApplyPersonalAllowance:  r.TaxApplyPersonalAllowance,
		TaxPersonalAllowanceAmount: r.TaxPersonalAllowanceAmount,
		TaxProgressiveBrackets:     r.TaxProgressiveBrackets,
		WithholdingTaxRateService:  r.WithholdingTaxRateService,
		Note:                       r.Note,
		CreatedAt:                  r.CreatedAt,
		UpdatedAt:                  r.UpdatedAt,
	}
}
