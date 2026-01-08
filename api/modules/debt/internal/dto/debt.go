package dto

import (
	"time"

	"github.com/google/uuid"

	"hrms/modules/debt/internal/repository"
)

type Item struct {
	ID                uuid.UUID  `json:"id"`
	EmployeeID        uuid.UUID  `json:"employeeId"`
	TxnDate           time.Time  `json:"txnDate"`
	TxnType           string     `json:"txnType"`
	OtherDesc         *string    `json:"otherDesc,omitempty"`
	Amount            float64    `json:"amount"`
	Reason            *string    `json:"reason,omitempty"`
	PayrollMonth      *time.Time `json:"payrollMonthDate,omitempty"`
	Status            string     `json:"status"`
	ParentID          *uuid.UUID `json:"parentId,omitempty"`
	EmployeeName      string     `json:"employeeName,omitempty"`
	EmployeeCode      string     `json:"employeeCode,omitempty"`
	CreatedAt         time.Time  `json:"createdAt"`
	UpdatedAt         time.Time  `json:"updatedAt"`
	Installments      []Item     `json:"installments,omitempty"`
	PaymentMethod     *string    `json:"paymentMethod,omitempty"`
	BankName          *string    `json:"bankName,omitempty"`
	BankAccountNumber *string    `json:"bankAccountNumber,omitempty"`
	TransferTime      *string    `json:"transferTime,omitempty"`
}

type Meta struct {
	CurrentPage int `json:"currentPage"`
	TotalPages  int `json:"totalPages"`
	TotalItems  int `json:"totalItems"`
}

func FromRecord(r repository.Record) Item {
	return Item{
		ID:                r.ID,
		EmployeeID:        r.EmployeeID,
		TxnDate:           r.TxnDate,
		TxnType:           r.TxnType,
		OtherDesc:         r.OtherDesc,
		Amount:            r.Amount,
		Reason:            r.Reason,
		PayrollMonth:      r.PayrollMonth,
		Status:            r.Status,
		ParentID:          r.ParentID,
		EmployeeName:      r.EmployeeName,
		EmployeeCode:      r.EmployeeCode,
		CreatedAt:         r.CreatedAt,
		UpdatedAt:         r.UpdatedAt,
		PaymentMethod:     r.PaymentMethod,
		BankName:          r.BankName,
		BankAccountNumber: r.BankAccountNumber,
		TransferTime:      r.TransferTime,
	}
}
