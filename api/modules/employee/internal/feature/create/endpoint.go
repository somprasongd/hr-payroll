package create

import (
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/employee/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

const dateLayout = "2006-01-02"

func (p *RequestBody) ParseDates() error {
	start, err := time.Parse(dateLayout, p.EmploymentStartDate)
	if err != nil {
		return errs.BadRequest("employmentStartDate must be YYYY-MM-DD")
	}
	p.ParsedEmploymentStartDate = start

	if p.EmploymentEndDate != nil && *p.EmploymentEndDate != "" {
		end, err := time.Parse(dateLayout, *p.EmploymentEndDate)
		if err != nil {
			return errs.BadRequest("employmentEndDate must be YYYY-MM-DD")
		}
		p.ParsedEmploymentEndDate = &end
	} else {
		p.ParsedEmploymentEndDate = nil
	}
	return nil
}

type RequestBody struct {
	EmployeeNumber              string       `json:"employeeNumber"`
	TitleID                     uuid.UUID    `json:"titleId"`
	FirstName                   string       `json:"firstName"`
	LastName                    string       `json:"lastName"`
	IDDocumentTypeID            uuid.UUID    `json:"idDocumentTypeId"`
	IDDocumentNumber            string       `json:"idDocumentNumber"`
	Phone                       *string      `json:"phone"`
	Email                       *string      `json:"email"`
	PhotoID                     OptionalUUID `json:"photoId"`
	EmployeeTypeID              uuid.UUID    `json:"employeeTypeId"`
	DepartmentID                OptionalUUID `json:"departmentId"`
	PositionID                  OptionalUUID `json:"positionId"`
	BasePayAmount               float64      `json:"basePayAmount"`
	EmploymentStartDate         string       `json:"employmentStartDate"`
	EmploymentEndDate           *string      `json:"employmentEndDate"`
	BankName                    *string      `json:"bankName"`
	BankAccountNo               *string      `json:"bankAccountNo"`
	SSOContribute               bool         `json:"ssoContribute"`
	SSODeclaredWage             *float64     `json:"ssoDeclaredWage"`
	ProvidentFundContribute     bool         `json:"providentFundContribute"`
	ProvidentFundRateEmployee   float64      `json:"providentFundRateEmployee"`
	ProvidentFundRateEmployer   float64      `json:"providentFundRateEmployer"`
	WithholdTax                 bool         `json:"withholdTax"`
	AllowHousing                bool         `json:"allowHousing"`
	AllowWater                  bool         `json:"allowWater"`
	AllowElectric               bool         `json:"allowElectric"`
	AllowInternet               bool         `json:"allowInternet"`
	AllowDoctorFee              bool         `json:"allowDoctorFee"`
	AllowAttendanceBonusNoLate  bool         `json:"allowAttendanceBonusNoLate"`
	AllowAttendanceBonusNoLeave bool         `json:"allowAttendanceBonusNoLeave"`

	ParsedEmploymentStartDate time.Time  `json:"-"`
	ParsedEmploymentEndDate   *time.Time `json:"-"`
}

func (p RequestBody) ToDetailRecord() repository.DetailRecord {
	return repository.DetailRecord{
		EmployeeNumber:              p.EmployeeNumber,
		TitleID:                     p.TitleID,
		FirstName:                   p.FirstName,
		LastName:                    p.LastName,
		IDDocumentTypeID:            p.IDDocumentTypeID,
		IDDocumentNumber:            p.IDDocumentNumber,
		Phone:                       p.Phone,
		Email:                       p.Email,
		PhotoID:                     p.PhotoID.Ptr(),
		EmployeeTypeID:              p.EmployeeTypeID,
		DepartmentID:                p.DepartmentID.Ptr(),
		PositionID:                  p.PositionID.Ptr(),
		BasePayAmount:               p.BasePayAmount,
		EmploymentStartDate:         p.ParsedEmploymentStartDate,
		EmploymentEndDate:           p.ParsedEmploymentEndDate,
		BankName:                    p.BankName,
		BankAccountNo:               p.BankAccountNo,
		SSOContribute:               p.SSOContribute,
		SSODeclaredWage:             p.SSODeclaredWage,
		ProvidentFundContribute:     p.ProvidentFundContribute,
		ProvidentFundRateEmployee:   p.ProvidentFundRateEmployee,
		ProvidentFundRateEmployer:   p.ProvidentFundRateEmployer,
		WithholdTax:                 p.WithholdTax,
		AllowHousing:                p.AllowHousing,
		AllowWater:                  p.AllowWater,
		AllowElectric:               p.AllowElectric,
		AllowInternet:               p.AllowInternet,
		AllowDoctorFee:              p.AllowDoctorFee,
		AllowAttendanceBonusNoLate:  p.AllowAttendanceBonusNoLate,
		AllowAttendanceBonusNoLeave: p.AllowAttendanceBonusNoLeave,
	}
}

// Create employee
// @Summary Create employee
// @Description เพิ่มข้อมูลพนักงานใหม่
// @Tags Employees
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body RequestBody true "employee payload"
// @Success 201 {object} Response
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 409
// @Router /employees [post]
func NewEndpoint(router fiber.Router) {
	router.Post("/", func(c fiber.Ctx) error {
		var req RequestBody
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}
		if err := req.ParseDates(); err != nil {
			return err
		}

		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			Payload: req,
			ActorID: user.ID,
		})
		if err != nil {
			return err
		}

		return response.JSON(c, fiber.StatusCreated, resp.Detail)
	})
}
