package dto

import (
	"encoding/json"

	"github.com/google/uuid"

	"hrms/modules/payrollrun/internal/repository"
)

type Item struct {
	ID                   uuid.UUID `json:"id"`
	RunID                uuid.UUID `json:"runId"`
	EmployeeID           uuid.UUID `json:"employeeId"`
	EmployeeNumber       string    `json:"employeeNumber,omitempty"`
	EmployeeTypeCode     string    `json:"employeeTypeCode,omitempty"`
	EmployeeName         string    `json:"employeeName,omitempty"`
	SalaryAmount         float64   `json:"salaryAmount"`
	OtHours              float64   `json:"otHours"`
	OtAmount             float64   `json:"otAmount"`
	BonusAmount          float64   `json:"bonusAmount"`
	LeaveCompensation    float64   `json:"leaveCompensationAmount"`
	IncomeTotal          float64   `json:"incomeTotal"`
	LeaveDaysQty         float64   `json:"leaveDaysQty"`
	LeaveDaysDeduction   float64   `json:"leaveDaysDeduction"`
	LateMinutesQty       int       `json:"lateMinutesQty"`
	LateMinutesDeduction float64   `json:"lateMinutesDeduction"`
	SsoMonthAmount       float64   `json:"ssoMonthAmount"`
	TaxMonthAmount       float64   `json:"taxMonthAmount"`
	NetPay               float64   `json:"netPay"`
	DeductionTotal       float64   `json:"deductionTotal"`
	Status               string    `json:"status"`
}

func FromItem(r repository.Item) Item {
	return Item{
		ID:                   r.ID,
		RunID:                r.RunID,
		EmployeeID:           r.EmployeeID,
		EmployeeNumber:       r.EmployeeNumber,
		EmployeeTypeCode:     r.EmployeeTypeCode,
		EmployeeName:         r.EmployeeName,
		SalaryAmount:         r.SalaryAmount,
		OtHours:              r.OtHours,
		OtAmount:             r.OtAmount,
		BonusAmount:          r.BonusAmount,
		LeaveCompensation:    r.LeaveCompensation,
		IncomeTotal:          r.IncomeTotal,
		LeaveDaysQty:         r.LeaveDaysQty,
		LeaveDaysDeduction:   r.LeaveDaysDeduction,
		LateMinutesQty:       r.LateMinutesQty,
		LateMinutesDeduction: r.LateMinutesDeduction,
		SsoMonthAmount:       r.SsoMonthAmount,
		TaxMonthAmount:       r.TaxMonthAmount,
		NetPay:               r.NetPay,
		DeductionTotal:       r.DeductionTotal,
		Status:               r.Status,
	}
}

func FromItemDetail(r repository.ItemDetail) ItemDetail {
	detail := ItemDetail{
		Item: Item{
			ID:                   r.ID,
			RunID:                r.RunID,
			EmployeeID:           r.EmployeeID,
			EmployeeNumber:       r.EmployeeNumber,
			EmployeeTypeCode:     r.EmployeeTypeCode,
			EmployeeName:         r.EmployeeName,
			SalaryAmount:         r.SalaryAmount,
			OtHours:              r.OtHours,
			OtAmount:             r.OtAmount,
			BonusAmount:          r.BonusAmount,
			LeaveCompensation:    r.LeaveCompensation,
			IncomeTotal:          r.IncomeTotal,
			LeaveDaysQty:         r.LeaveDaysQty,
			LeaveDaysDeduction:   r.LeaveDaysDeduction,
			LateMinutesQty:       r.LateMinutesQty,
			LateMinutesDeduction: r.LateMinutesDeduction,
			SsoMonthAmount:       r.SsoMonthAmount,
			TaxMonthAmount:       r.TaxMonthAmount,
			NetPay:               r.NetPay,
			DeductionTotal:       r.DeductionTotal,
			Status:               r.Status,
		},
		HousingAllowance:       r.HousingAllowance,
		AttendanceBonusNoLate:  r.AttendanceBonusNoLate,
		AttendanceBonusNoLeave: r.AttendanceBonusNoLeave,
		LeaveDoubleQty:         r.LeaveDoubleQty,
		LeaveDoubleDeduction:   r.LeaveDoubleDeduction,
		LeaveHoursQty:          r.LeaveHoursQty,
		LeaveHoursDeduction:    r.LeaveHoursDeduction,
		SsoDeclaredWage:        r.SsoDeclaredWage,
		SsoAccumPrev:           r.SsoAccumPrev,
		SsoAccumTotal:          r.SsoAccumTotal,
		TaxAccumPrev:           r.TaxAccumPrev,
		TaxAccumTotal:          r.TaxAccumTotal,
		PFAccumPrev:            r.PFAccumPrev,
		PFMonthAmount:          r.PFMonthAmount,
		PFAccumTotal:           r.PFAccumTotal,
		AdvanceAmount:          r.AdvanceAmount,
		AdvanceRepayAmount:     r.AdvanceRepayAmount,
		AdvanceDiffAmount:      r.AdvanceDiffAmount,
		LoanOutstandingPrev:    r.LoanOutstandingPrev,
		LoanOutstandingTotal:   r.LoanOutstandingTotal,
		WaterAmount:            r.WaterAmount,
		ElectricAmount:         r.ElectricAmount,
		InternetAmount:         r.InternetAmount,
		WaterMeterPrev:         r.WaterMeterPrev,
		WaterMeterCurr:         r.WaterMeterCurr,
		ElectricMeterPrev:      r.ElectricMeterPrev,
		ElectricMeterCurr:      r.ElectricMeterCurr,
		WaterRatePerUnit:       r.WaterRatePerUnit,
		ElectricityRatePerUnit: r.ElectricityRatePerUnit,
		BankAccount:            r.BankAccount,
	}

	if len(r.LoanRepayments) > 0 {
		detail.LoanRepayments = decodeJSONMapArray(r.LoanRepayments)
	}
	if len(r.OthersIncome) > 0 {
		detail.OthersIncome = decodeJSONMapArray(r.OthersIncome)
	}
	return detail
}

func decodeJSONMapArray(b []byte) []map[string]interface{} {
	var out []map[string]interface{}
	_ = json.Unmarshal(b, &out)
	return out
}

type ItemDetail struct {
	Item
	HousingAllowance       float64                  `json:"housingAllowance"`
	AttendanceBonusNoLate  float64                  `json:"attendanceBonusNoLate"`
	AttendanceBonusNoLeave float64                  `json:"attendanceBonusNoLeave"`
	LeaveDoubleQty         float64                  `json:"leaveDoubleQty"`
	LeaveDoubleDeduction   float64                  `json:"leaveDoubleDeduction"`
	LeaveHoursQty          float64                  `json:"leaveHoursQty"`
	LeaveHoursDeduction    float64                  `json:"leaveHoursDeduction"`
	LeaveCompensation      float64                  `json:"leaveCompensationAmount"`
	SsoDeclaredWage        float64                  `json:"ssoDeclaredWage"`
	SsoAccumPrev           float64                  `json:"ssoAccumPrev"`
	SsoAccumTotal          float64                  `json:"ssoAccumTotal"`
	TaxAccumPrev           float64                  `json:"taxAccumPrev"`
	TaxAccumTotal          float64                  `json:"taxAccumTotal"`
	PFAccumPrev            float64                  `json:"pfAccumPrev"`
	PFMonthAmount          float64                  `json:"pfMonthAmount"`
	PFAccumTotal           float64                  `json:"pfAccumTotal"`
	AdvanceAmount          float64                  `json:"advanceAmount"`
	AdvanceRepayAmount     float64                  `json:"advanceRepayAmount"`
	AdvanceDiffAmount      float64                  `json:"advanceDiffAmount"`
	LoanOutstandingPrev    float64                  `json:"loanOutstandingPrev"`
	LoanOutstandingTotal   float64                  `json:"loanOutstandingTotal"`
	LoanRepayments         []map[string]interface{} `json:"loanRepayments,omitempty"`
	OthersIncome           []map[string]interface{} `json:"othersIncome,omitempty"`
	WaterAmount            float64                  `json:"waterAmount"`
	ElectricAmount         float64                  `json:"electricAmount"`
	InternetAmount         float64                  `json:"internetAmount"`
	WaterMeterPrev         *float64                 `json:"waterMeterPrev,omitempty"`
	WaterMeterCurr         *float64                 `json:"waterMeterCurr,omitempty"`
	ElectricMeterPrev      *float64                 `json:"electricMeterPrev,omitempty"`
	ElectricMeterCurr      *float64                 `json:"electricMeterCurr,omitempty"`
	WaterRatePerUnit       float64                  `json:"waterRatePerUnit"`
	ElectricityRatePerUnit float64                  `json:"electricityRatePerUnit"`
	BankAccount            *string                  `json:"bankAccount,omitempty"`
}
