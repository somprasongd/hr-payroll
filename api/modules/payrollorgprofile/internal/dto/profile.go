package dto

import (
	"time"

	"github.com/google/uuid"

	"hrms/modules/payrollorgprofile/internal/repository"
)

type Profile struct {
	ID             uuid.UUID  `json:"id"`
	VersionNo      int64      `json:"versionNo"`
	StartDate      string     `json:"startDate"`
	EndDate        *string    `json:"endDate,omitempty"`
	Status         string     `json:"status"`
	CompanyName    string     `json:"companyName"`
	AddressLine1   *string    `json:"addressLine1,omitempty"`
	AddressLine2   *string    `json:"addressLine2,omitempty"`
	Subdistrict    *string    `json:"subdistrict,omitempty"`
	District       *string    `json:"district,omitempty"`
	Province       *string    `json:"province,omitempty"`
	PostalCode     *string    `json:"postalCode,omitempty"`
	PhoneMain      *string    `json:"phoneMain,omitempty"`
	PhoneAlt       *string    `json:"phoneAlt,omitempty"`
	Email          *string    `json:"email,omitempty"`
	TaxID          *string    `json:"taxId,omitempty"`
	SlipFooterNote *string    `json:"slipFooterNote,omitempty"`
	LogoID         *uuid.UUID `json:"logoId,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
	CreatedBy      uuid.UUID  `json:"createdBy"`
	UpdatedBy      uuid.UUID  `json:"updatedBy"`
}

type Meta struct {
	CurrentPage int `json:"currentPage"`
	TotalPages  int `json:"totalPages"`
	TotalItems  int `json:"totalItems"`
}

func FromRecord(r repository.Record) Profile {
	const dateFmt = "2006-01-02"

	var endDateStr *string
	if r.EndDate != nil {
		val := r.EndDate.Format(dateFmt)
		endDateStr = &val
	}

	return Profile{
		ID:             r.ID,
		VersionNo:      r.VersionNo,
		StartDate:      r.StartDate.Format(dateFmt),
		EndDate:        endDateStr,
		Status:         r.Status,
		CompanyName:    r.CompanyName,
		AddressLine1:   r.AddressLine1,
		AddressLine2:   r.AddressLine2,
		Subdistrict:    r.Subdistrict,
		District:       r.District,
		Province:       r.Province,
		PostalCode:     r.PostalCode,
		PhoneMain:      r.PhoneMain,
		PhoneAlt:       r.PhoneAlt,
		Email:          r.Email,
		TaxID:          r.TaxID,
		SlipFooterNote: r.SlipFooterNote,
		LogoID:         r.LogoID,
		CreatedAt:      r.CreatedAt,
		UpdatedAt:      r.UpdatedAt,
		CreatedBy:      r.CreatedBy,
		UpdatedBy:      r.UpdatedBy,
	}
}
