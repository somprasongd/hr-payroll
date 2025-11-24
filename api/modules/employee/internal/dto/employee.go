package dto

import (
	"time"

	"github.com/google/uuid"

	"hrms/modules/employee/internal/repository"
)

type ListItem struct {
	ID                  uuid.UUID `json:"id"`
	EmployeeNumber      string    `json:"employeeNumber"`
	FullNameTh          string    `json:"fullNameTh"`
	EmployeeTypeName    string    `json:"employeeTypeName"`
	Phone               *string   `json:"phone,omitempty"`
	Email               *string   `json:"email,omitempty"`
	EmploymentStartDate time.Time `json:"employmentStartDate"`
	Status              string    `json:"status"`
}

type Meta struct {
	CurrentPage int `json:"currentPage"`
	TotalPages  int `json:"totalPages"`
	TotalItems  int `json:"totalItems"`
}

type Detail struct {
	ID                        uuid.UUID  `json:"id"`
	EmployeeNumber            string     `json:"employeeNumber"`
	TitleID                   uuid.UUID  `json:"titleId"`
	FirstName                 string     `json:"firstName"`
	LastName                  string     `json:"lastName"`
	IDDocumentTypeID          uuid.UUID  `json:"idDocumentTypeId"`
	IDDocumentNumber          string     `json:"idDocumentNumber"`
	Phone                     *string    `json:"phone,omitempty"`
	Email                     *string    `json:"email,omitempty"`
	EmployeeTypeID            uuid.UUID  `json:"employeeTypeId"`
	BasePayAmount             float64    `json:"basePayAmount"`
	EmploymentStartDate       time.Time  `json:"employmentStartDate"`
	EmploymentEndDate         *time.Time `json:"employmentEndDate,omitempty"`
	BankName                  *string    `json:"bankName,omitempty"`
	BankAccountNo             *string    `json:"bankAccountNo,omitempty"`
	SSOContribute             bool       `json:"ssoContribute"`
	SSODeclaredWage           *float64   `json:"ssoDeclaredWage,omitempty"`
	ProvidentFundContribute   bool       `json:"providentFundContribute"`
	ProvidentFundRateEmployee float64    `json:"providentFundRateEmployee"`
	ProvidentFundRateEmployer float64    `json:"providentFundRateEmployer"`
	WithholdTax               bool       `json:"withholdTax"`
	AllowHousing              bool       `json:"allowHousing"`
	AllowWater                bool       `json:"allowWater"`
	AllowElectric             bool       `json:"allowElectric"`
	AllowInternet             bool       `json:"allowInternet"`
	AllowDoctorFee            bool       `json:"allowDoctorFee"`
	CreatedAt                 time.Time  `json:"createdAt"`
	UpdatedAt                 time.Time  `json:"updatedAt"`
	Status                    string     `json:"status"`
}

func FromListRecord(r repository.ListRecord) ListItem {
	return ListItem{
		ID:                  r.ID,
		EmployeeNumber:      r.EmployeeNumber,
		FullNameTh:          r.FullNameTh,
		EmployeeTypeName:    r.EmployeeTypeName,
		Phone:               r.Phone,
		Email:               r.Email,
		EmploymentStartDate: r.EmploymentStartDate,
		Status:              r.Status,
	}
}

func FromDetailRecord(r repository.DetailRecord) Detail {
	return Detail{
		ID:                        r.ID,
		EmployeeNumber:            r.EmployeeNumber,
		TitleID:                   r.TitleID,
		FirstName:                 r.FirstName,
		LastName:                  r.LastName,
		IDDocumentTypeID:          r.IDDocumentTypeID,
		IDDocumentNumber:          r.IDDocumentNumber,
		Phone:                     r.Phone,
		Email:                     r.Email,
		EmployeeTypeID:            r.EmployeeTypeID,
		BasePayAmount:             r.BasePayAmount,
		EmploymentStartDate:       r.EmploymentStartDate,
		EmploymentEndDate:         r.EmploymentEndDate,
		BankName:                  r.BankName,
		BankAccountNo:             r.BankAccountNo,
		SSOContribute:             r.SSOContribute,
		SSODeclaredWage:           r.SSODeclaredWage,
		ProvidentFundContribute:   r.ProvidentFundContribute,
		ProvidentFundRateEmployee: r.ProvidentFundRateEmployee,
		ProvidentFundRateEmployer: r.ProvidentFundRateEmployer,
		WithholdTax:               r.WithholdTax,
		AllowHousing:              r.AllowHousing,
		AllowWater:                r.AllowWater,
		AllowElectric:             r.AllowElectric,
		AllowInternet:             r.AllowInternet,
		AllowDoctorFee:            r.AllowDoctorFee,
		CreatedAt:                 r.CreatedAt,
		UpdatedAt:                 r.UpdatedAt,
		Status:                    r.Status,
	}
}
