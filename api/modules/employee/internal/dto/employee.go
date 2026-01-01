package dto

import (
	"time"

	"github.com/google/uuid"

	"hrms/modules/employee/internal/repository"
)

const dateLayout = "2006-01-02"

type ListItem struct {
	ID                  uuid.UUID  `json:"id"`
	EmployeeNumber      string     `json:"employeeNumber"`
	FullNameTh          string     `json:"fullNameTh"`
	TitleName           *string    `json:"titleName,omitempty"`
	EmployeeTypeName    string     `json:"employeeTypeName"`
	Phone               *string    `json:"phone,omitempty"`
	Email               *string    `json:"email,omitempty"`
	PhotoID             *uuid.UUID `json:"photoId,omitempty"`
	EmploymentStartDate string     `json:"employmentStartDate"`
	Status              string     `json:"status"`
}

type Meta struct {
	CurrentPage int `json:"currentPage"`
	TotalPages  int `json:"totalPages"`
	TotalItems  int `json:"totalItems"`
}

type Detail struct {
	ID                          uuid.UUID  `json:"id"`
	EmployeeNumber              string     `json:"employeeNumber"`
	TitleID                     uuid.UUID  `json:"titleId"`
	TitleName                   *string    `json:"titleName,omitempty"`
	FirstName                   string     `json:"firstName"`
	LastName                    string     `json:"lastName"`
	Nickname                    *string    `json:"nickname,omitempty"`
	IDDocumentTypeID            uuid.UUID  `json:"idDocumentTypeId"`
	IDDocumentNumber            string     `json:"idDocumentNumber"`
	IDDocumentOtherDescription  *string    `json:"idDocumentOtherDescription,omitempty"`
	Phone                       *string    `json:"phone,omitempty"`
	Email                       *string    `json:"email,omitempty"`
	PhotoID                     *uuid.UUID `json:"photoId,omitempty"`
	EmployeeTypeID              uuid.UUID  `json:"employeeTypeId"`
	DepartmentID                *uuid.UUID `json:"departmentId,omitempty"`
	PositionID                  *uuid.UUID `json:"positionId,omitempty"`
	BasePayAmount               float64    `json:"basePayAmount"`
	EmploymentStartDate         string     `json:"employmentStartDate"`
	EmploymentEndDate           *string    `json:"employmentEndDate,omitempty"`
	BankName                    *string    `json:"bankName,omitempty"`
	BankAccountNo               *string    `json:"bankAccountNo,omitempty"`
	SSOContribute               bool       `json:"ssoContribute"`
	SSODeclaredWage             *float64   `json:"ssoDeclaredWage,omitempty"`
	SSOHospitalName             *string    `json:"ssoHospitalName,omitempty"`
	ProvidentFundContribute     bool       `json:"providentFundContribute"`
	ProvidentFundRateEmployee   float64    `json:"providentFundRateEmployee"`
	ProvidentFundRateEmployer   float64    `json:"providentFundRateEmployer"`
	WithholdTax                 bool       `json:"withholdTax"`
	AllowHousing                bool       `json:"allowHousing"`
	AllowWater                  bool       `json:"allowWater"`
	AllowElectric               bool       `json:"allowElectric"`
	AllowInternet               bool       `json:"allowInternet"`
	AllowDoctorFee              bool       `json:"allowDoctorFee"`
	AllowAttendanceBonusNoLate  bool       `json:"allowAttendanceBonusNoLate"`
	AllowAttendanceBonusNoLeave bool       `json:"allowAttendanceBonusNoLeave"`
	CreatedAt                   time.Time  `json:"createdAt"`
	UpdatedAt                   time.Time  `json:"updatedAt"`
	Status                      string     `json:"status"`
}

func FromListRecord(r repository.ListRecord) ListItem {
	return ListItem{
		ID:                  r.ID,
		EmployeeNumber:      r.EmployeeNumber,
		FullNameTh:          r.FullNameTh,
		TitleName:           r.TitleName,
		EmployeeTypeName:    r.EmployeeTypeName,
		Phone:               r.Phone,
		Email:               r.Email,
		PhotoID:             r.PhotoID,
		EmploymentStartDate: r.EmploymentStartDate.Format(dateLayout),
		Status:              r.Status,
	}
}

func FromDetailRecord(r repository.DetailRecord) Detail {
	var endDateStr *string
	if r.EmploymentEndDate != nil {
		val := r.EmploymentEndDate.Format(dateLayout)
		endDateStr = &val
	}

	return Detail{
		ID:                          r.ID,
		EmployeeNumber:              r.EmployeeNumber,
		TitleID:                     r.TitleID,
		FirstName:                   r.FirstName,
		LastName:                    r.LastName,
		IDDocumentTypeID:            r.IDDocumentTypeID,
		IDDocumentNumber:            r.IDDocumentNumber,
		Phone:                       r.Phone,
		Email:                       r.Email,
		TitleName:                   r.TitleName,
		PhotoID:                     r.PhotoID,
		EmployeeTypeID:              r.EmployeeTypeID,
		DepartmentID:                r.DepartmentID,
		PositionID:                  r.PositionID,
		BasePayAmount:               r.BasePayAmount,
		EmploymentStartDate:         r.EmploymentStartDate.Format(dateLayout),
		EmploymentEndDate:           endDateStr,
		BankName:                    r.BankName,
		BankAccountNo:               r.BankAccountNo,
		SSOContribute:               r.SSOContribute,
		SSODeclaredWage:             r.SSODeclaredWage,
		Nickname:                    r.Nickname,
		IDDocumentOtherDescription:  r.IDDocumentOtherDescription,
		SSOHospitalName:             r.SSOHospitalName,
		ProvidentFundContribute:     r.ProvidentFundContribute,
		ProvidentFundRateEmployee:   r.ProvidentFundRateEmployee,
		ProvidentFundRateEmployer:   r.ProvidentFundRateEmployer,
		WithholdTax:                 r.WithholdTax,
		AllowHousing:                r.AllowHousing,
		AllowWater:                  r.AllowWater,
		AllowElectric:               r.AllowElectric,
		AllowInternet:               r.AllowInternet,
		AllowDoctorFee:              r.AllowDoctorFee,
		AllowAttendanceBonusNoLate:  r.AllowAttendanceBonusNoLate,
		AllowAttendanceBonusNoLeave: r.AllowAttendanceBonusNoLeave,
		CreatedAt:                   r.CreatedAt,
		UpdatedAt:                   r.UpdatedAt,
		Status:                      r.Status,
	}
}
