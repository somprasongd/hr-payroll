package create

import (
	"log"
	"time"

	"github.com/gofiber/fiber/v3"

	"hrms/modules/payrollconfig/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

type RequestBody struct {
	StartDate                  string                 `json:"startDate"`
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
	TaxApplyStandardExpense    *bool                  `json:"taxApplyStandardExpense"`
	TaxStandardExpenseRate     *float64               `json:"taxStandardExpenseRate"`
	TaxStandardExpenseCap      *float64               `json:"taxStandardExpenseCap"`
	TaxApplyPersonalAllowance  *bool                  `json:"taxApplyPersonalAllowance"`
	TaxPersonalAllowanceAmount *float64               `json:"taxPersonalAllowanceAmount"`
	TaxProgressiveBrackets     repository.TaxBrackets `json:"taxProgressiveBrackets"`
	WithholdingTaxRateService  *float64               `json:"withholdingTaxRateService"`
	WorkHoursPerDay            *float64               `json:"workHoursPerDay"`
	LateRatePerMinute          *float64               `json:"lateRatePerMinute"`
	LateGraceMinutes           *int                   `json:"lateGraceMinutes"`
	Note                       *string                `json:"note"`

	ParsedStartDate time.Time `json:"-"`
}

func (p RequestBody) ToRecord() repository.Record {
	return repository.Record{
		StartDate:                  p.ParsedStartDate,
		HourlyRate:                 p.HourlyRate,
		OtHourlyRate:               p.OtHourlyRate,
		AttendanceBonusNoLate:      p.AttendanceBonusNoLate,
		AttendanceBonusNoLeave:     p.AttendanceBonusNoLeave,
		HousingAllowance:           p.HousingAllowance,
		WaterRatePerUnit:           p.WaterRatePerUnit,
		ElectricityRatePerUnit:     p.ElectricityRatePerUnit,
		InternetFeeMonthly:         p.InternetFeeMonthly,
		SocialSecurityRateEmployee: p.SocialSecurityRateEmployee,
		SocialSecurityRateEmployer: p.SocialSecurityRateEmployer,
		SocialSecurityWageCap:      p.SocialSecurityWageCap,
		TaxApplyStandardExpense:    boolValue(p.TaxApplyStandardExpense),
		TaxStandardExpenseRate:     floatValue(p.TaxStandardExpenseRate),
		TaxStandardExpenseCap:      floatValue(p.TaxStandardExpenseCap),
		TaxApplyPersonalAllowance:  boolValue(p.TaxApplyPersonalAllowance),
		TaxPersonalAllowanceAmount: floatValue(p.TaxPersonalAllowanceAmount),
		TaxProgressiveBrackets:     p.TaxProgressiveBrackets,
		WithholdingTaxRateService:  floatValue(p.WithholdingTaxRateService),
		WorkHoursPerDay:            floatValue(p.WorkHoursPerDay),
		LateRatePerMinute:          floatValue(p.LateRatePerMinute),
		LateGraceMinutes:           intValue(p.LateGraceMinutes),
		Note:                       p.Note,
	}
}

// Create payroll config
// @Summary Create payroll config
// @Description สร้างเวอร์ชัน config ใหม่
// @Tags Payroll Config
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body RequestBody true "config payload"
// @Success 201 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Router /admin/payroll-configs [post]
func NewEndpoint(router fiber.Router) {
	router.Post("/", func(c fiber.Ctx) error {
		var req RequestBody
		if err := c.Bind().Body(&req); err != nil {
			log.Println(err)
			return errs.BadRequest("invalid request body")
		}

		parsedStart, err := time.Parse("2006-01-02", req.StartDate)
		if err != nil {
			return errs.BadRequest("startDate must be in format YYYY-MM-DD")
		}
		req.ParsedStartDate = parsedStart

		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		tenant, ok := contextx.TenantFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing tenant context")
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			Payload:   req,
			CompanyID: tenant.CompanyID,
			ActorID:   user.ID,
		})
		if err != nil {
			return err
		}

		return response.JSON(c, fiber.StatusCreated, resp.Config)
	})
}

func boolValue(v *bool) bool {
	if v == nil {
		return false
	}
	return *v
}

func floatValue(v *float64) float64 {
	if v == nil {
		return 0
	}
	return *v
}

func intValue(v *int) int {
	if v == nil {
		return 0
	}
	return *v
}
