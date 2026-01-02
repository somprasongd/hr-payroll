package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"hrms/shared/common/contextx"
	"hrms/shared/common/storage/sqldb/transactor"
)

type Repository struct {
	dbCtx transactor.DBTXContext
}

func NewRepository(dbCtx transactor.DBTXContext) *Repository {
	return &Repository{dbCtx: dbCtx}
}

// EmployeeSummary contains aggregated employee statistics
type EmployeeSummary struct {
	TotalEmployees      int `db:"total_employees"`
	ActiveEmployees     int `db:"active_employees"`
	FullTimeCount       int `db:"full_time_count"`
	PartTimeCount       int `db:"part_time_count"`
	NewThisMonth        int `db:"new_this_month"`
	TerminatedThisMonth int `db:"terminated_this_month"`
}

type DepartmentCount struct {
	DepartmentID   *uuid.UUID `db:"department_id"`
	DepartmentName string     `db:"department_name"`
	Count          int        `db:"count"`
}

// GetEmployeeSummary retrieves aggregated employee statistics
func (r *Repository) GetEmployeeSummary(ctx context.Context, tenant contextx.TenantInfo) (*EmployeeSummary, error) {
	db := r.dbCtx(ctx)

	// Build filter
	where := []string{"deleted_at IS NULL"}
	args := []interface{}{}

	// Company filter
	args = append(args, tenant.CompanyID)
	where = append(where, fmt.Sprintf("company_id = $%d", len(args)))

	// Branch filter
	if tenant.HasBranchID() {
		args = append(args, tenant.BranchID)
		where = append(where, fmt.Sprintf("branch_id = $%d", len(args)))
	}

	whereClause := " WHERE " + strings.Join(where, " AND ")

	query := fmt.Sprintf(`
WITH stats AS (
    SELECT
        COUNT(*) FILTER (WHERE deleted_at IS NULL) AS total_employees,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND (employment_end_date IS NULL OR employment_end_date > CURRENT_DATE)) AS active_employees,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND et.code = 'full_time' AND (employment_end_date IS NULL OR employment_end_date > CURRENT_DATE)) AS full_time_count,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND et.code = 'part_time' AND (employment_end_date IS NULL OR employment_end_date > CURRENT_DATE)) AS part_time_count,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND employment_start_date >= date_trunc('month', CURRENT_DATE)) AS new_this_month,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND employment_end_date IS NOT NULL AND employment_end_date >= date_trunc('month', CURRENT_DATE) AND employment_end_date <= CURRENT_DATE) AS terminated_this_month
    FROM employees e
    LEFT JOIN employee_type et ON e.employee_type_id = et.id
    %s
)
SELECT * FROM stats
`, whereClause)

	var summary EmployeeSummary
	if err := db.GetContext(ctx, &summary, query, args...); err != nil {
		return nil, err
	}
	return &summary, nil
}

// GetEmployeesByDepartment retrieves employee counts by department
func (r *Repository) GetEmployeesByDepartment(ctx context.Context, tenant contextx.TenantInfo) ([]DepartmentCount, error) {
	db := r.dbCtx(ctx)

	args := []interface{}{}
	where := []string{
		"e.deleted_at IS NULL",
		"(e.employment_end_date IS NULL OR e.employment_end_date > CURRENT_DATE)",
	}

	// Company filter
	args = append(args, tenant.CompanyID)
	where = append(where, fmt.Sprintf("e.company_id = $%d", len(args)))

	// Branch filter
	if tenant.HasBranchID() {
		args = append(args, tenant.BranchID)
		where = append(where, fmt.Sprintf("e.branch_id = $%d", len(args)))
	}

	query := fmt.Sprintf(`
SELECT 
    e.department_id,
    COALESCE(d.name_th, 'ไม่ระบุแผนก') AS department_name,
    COUNT(*) AS count
FROM employees e
LEFT JOIN department d ON e.department_id = d.id AND d.deleted_at IS NULL
WHERE %s
GROUP BY e.department_id, d.name_th
ORDER BY count DESC
`, strings.Join(where, " AND "))

	var results []DepartmentCount
	if err := db.SelectContext(ctx, &results, query, args...); err != nil {
		return nil, err
	}
	return results, nil
}

// AttendanceEntry represents a single attendance record for aggregation
type AttendanceEntry struct {
	Period     string  `db:"period"`
	EntryType  string  `db:"entry_type"`
	TotalCount int     `db:"total_count"`
	TotalQty   float64 `db:"total_qty"`
}

// GetAttendanceSummary retrieves attendance statistics grouped by period
func (r *Repository) GetAttendanceSummary(ctx context.Context, tenant contextx.TenantInfo, startDate, endDate time.Time, groupBy string, departmentID *uuid.UUID, employeeID *uuid.UUID) ([]AttendanceEntry, error) {
	db := r.dbCtx(ctx)

	periodFormat := "YYYY-MM"
	if groupBy == "day" {
		periodFormat = "YYYY-MM-DD"
	}

	args := []interface{}{startDate, endDate}

	where := []string{
		"wl.deleted_at IS NULL",
		"wl.work_date >= $1",
		"wl.work_date <= $2",
	}

	// Company filter (on employees table)
	args = append(args, tenant.CompanyID)
	where = append(where, fmt.Sprintf("e.company_id = $%d", len(args)))

	// Branch filter (on employees table)
	if tenant.HasBranchID() {
		args = append(args, tenant.BranchID)
		where = append(where, fmt.Sprintf("e.branch_id = $%d", len(args)))
	}

	// Department filter
	if departmentID != nil {
		args = append(args, *departmentID)
		where = append(where, fmt.Sprintf("e.department_id = $%d", len(args)))
	}

	if employeeID != nil {
		args = append(args, *employeeID)
		where = append(where, fmt.Sprintf("wl.employee_id = $%d", len(args)))
	}

	query := fmt.Sprintf(`
SELECT 
    TO_CHAR(wl.work_date, '%s') AS period,
    wl.entry_type,
    COUNT(*) AS total_count,
    COALESCE(SUM(wl.quantity), 0) AS total_qty
FROM worklog_ft wl
INNER JOIN employees e ON wl.employee_id = e.id AND e.deleted_at IS NULL
WHERE %s
GROUP BY TO_CHAR(wl.work_date, '%s'), wl.entry_type
ORDER BY period, entry_type
`, periodFormat, strings.Join(where, " AND "), periodFormat)

	var results []AttendanceEntry
	if err := db.SelectContext(ctx, &results, query, args...); err != nil {
		return nil, err
	}
	return results, nil
}

// PayrollRunSummary represents payroll run statistics
type PayrollRunSummary struct {
	ID               uuid.UUID  `db:"id"`
	PayrollMonthDate time.Time  `db:"payroll_month_date"`
	Status           string     `db:"status"`
	TotalNetPay      float64    `db:"total_net_pay"`
	TotalTax         float64    `db:"total_tax"`
	TotalSso         float64    `db:"total_sso"`
	TotalPf          float64    `db:"total_pf"`
	EmployeeCount    int        `db:"employee_count"`
	ApprovedAt       *time.Time `db:"approved_at"`
}

// GetLatestPayrollRun retrieves the most recent payroll run
func (r *Repository) GetLatestPayrollRun(ctx context.Context, tenant contextx.TenantInfo) (*PayrollRunSummary, error) {
	db := r.dbCtx(ctx)

	args := []interface{}{}
	where := []string{"pr.deleted_at IS NULL"}

	// Company filter
	args = append(args, tenant.CompanyID)
	where = append(where, fmt.Sprintf("pr.company_id = $%d", len(args)))

	// Branch filter
	if tenant.HasBranchID() {
		args = append(args, tenant.BranchID)
		where = append(where, fmt.Sprintf("pr.branch_id = $%d", len(args)))
	}

	query := fmt.Sprintf(`
SELECT 
    pr.id,
    pr.payroll_month_date,
    pr.status,
    pr.approved_at,
    COALESCE(SUM(pri.income_total - (pri.late_minutes_deduction + pri.leave_days_deduction + pri.leave_double_deduction + pri.leave_hours_deduction + pri.sso_month_amount + pri.tax_month_amount + pri.pf_month_amount + pri.water_amount + pri.electric_amount + pri.internet_amount + pri.advance_repay_amount + COALESCE((SELECT SUM((item->>'amount')::numeric) FROM jsonb_array_elements(pri.loan_repayments) AS item), 0) + COALESCE((SELECT SUM((item->>'value')::numeric) FROM jsonb_array_elements(pri.others_deduction) AS item), 0))), 0) AS total_net_pay,
    COALESCE(SUM(pri.tax_month_amount), 0) AS total_tax,
    COALESCE(SUM(pri.sso_month_amount), 0) AS total_sso,
    COALESCE(SUM(pri.pf_month_amount), 0) AS total_pf,
    COUNT(pri.id) AS employee_count
FROM payroll_run pr
LEFT JOIN payroll_run_item pri ON pr.id = pri.run_id
WHERE %s
GROUP BY pr.id, pr.payroll_month_date, pr.status, pr.approved_at
ORDER BY pr.payroll_month_date DESC
LIMIT 1
`, strings.Join(where, " AND "))

	var summary PayrollRunSummary
	if err := db.GetContext(ctx, &summary, query, args...); err != nil {
		return nil, err
	}
	return &summary, nil
}

// YearlyPayrollTotals represents yearly aggregated payroll data
type YearlyPayrollTotals struct {
	TotalNetPay float64 `db:"total_net_pay"`
	TotalTax    float64 `db:"total_tax"`
	TotalSso    float64 `db:"total_sso"`
	TotalPf     float64 `db:"total_pf"`
}

// GetYearlyPayrollTotals retrieves yearly totals for payroll
func (r *Repository) GetYearlyPayrollTotals(ctx context.Context, tenant contextx.TenantInfo, year int) (*YearlyPayrollTotals, error) {
	db := r.dbCtx(ctx)

	args := []interface{}{year, tenant.CompanyID}
	where := []string{
		"pr.deleted_at IS NULL",
		"pr.status = 'approved'",
		"EXTRACT(YEAR FROM pr.payroll_month_date) = $1",
		"pr.company_id = $2",
	}

	if tenant.HasBranchID() {
		args = append(args, tenant.BranchID)
		where = append(where, fmt.Sprintf("pr.branch_id = $%d", len(args)))
	}

	query := fmt.Sprintf(`
SELECT 
    COALESCE(SUM(pri.income_total - (pri.late_minutes_deduction + pri.leave_days_deduction + pri.leave_double_deduction + pri.leave_hours_deduction + pri.sso_month_amount + pri.tax_month_amount + pri.pf_month_amount + pri.water_amount + pri.electric_amount + pri.internet_amount + pri.advance_repay_amount + COALESCE((SELECT SUM((item->>'amount')::numeric) FROM jsonb_array_elements(pri.loan_repayments) AS item), 0) + COALESCE((SELECT SUM((item->>'value')::numeric) FROM jsonb_array_elements(pri.others_deduction) AS item), 0))), 0) AS total_net_pay,
    COALESCE(SUM(pri.tax_month_amount), 0) AS total_tax,
    COALESCE(SUM(pri.sso_month_amount), 0) AS total_sso,
    COALESCE(SUM(pri.pf_month_amount), 0) AS total_pf
FROM payroll_run pr
JOIN payroll_run_item pri ON pr.id = pri.run_id
WHERE %s
`, strings.Join(where, " AND "))
	var totals YearlyPayrollTotals
	if err := db.GetContext(ctx, &totals, query, args...); err != nil {
		return nil, err
	}
	return &totals, nil
}

// MonthlyPayrollBreakdown represents monthly payroll breakdown
type MonthlyPayrollBreakdown struct {
	Month  string  `db:"month"`
	NetPay float64 `db:"net_pay"`
	Tax    float64 `db:"tax"`
	Sso    float64 `db:"sso"`
	Pf     float64 `db:"pf"`
}

// GetMonthlyPayrollBreakdown retrieves monthly breakdown for a year
func (r *Repository) GetMonthlyPayrollBreakdown(ctx context.Context, tenant contextx.TenantInfo, year int) ([]MonthlyPayrollBreakdown, error) {
	db := r.dbCtx(ctx)

	args := []interface{}{year, tenant.CompanyID}
	where := []string{
		"pr.deleted_at IS NULL",
		"pr.status = 'approved'",
		"EXTRACT(YEAR FROM pr.payroll_month_date) = $1",
		"pr.company_id = $2",
	}

	if tenant.HasBranchID() {
		args = append(args, tenant.BranchID)
		where = append(where, fmt.Sprintf("pr.branch_id = $%d", len(args)))
	}

	query := fmt.Sprintf(`
SELECT 
    TO_CHAR(pr.payroll_month_date, 'YYYY-MM') AS month,
    COALESCE(SUM(pri.income_total - (pri.late_minutes_deduction + pri.leave_days_deduction + pri.leave_double_deduction + pri.leave_hours_deduction + pri.sso_month_amount + pri.tax_month_amount + pri.pf_month_amount + pri.water_amount + pri.electric_amount + pri.internet_amount + pri.advance_repay_amount + COALESCE((SELECT SUM((item->>'amount')::numeric) FROM jsonb_array_elements(pri.loan_repayments) AS item), 0) + COALESCE((SELECT SUM((item->>'value')::numeric) FROM jsonb_array_elements(pri.others_deduction) AS item), 0))), 0) AS net_pay,
    COALESCE(SUM(pri.tax_month_amount), 0) AS tax,
    COALESCE(SUM(pri.sso_month_amount), 0) AS sso,
    COALESCE(SUM(pri.pf_month_amount), 0) AS pf
FROM payroll_run pr
JOIN payroll_run_item pri ON pr.id = pri.run_id
WHERE %s
GROUP BY TO_CHAR(pr.payroll_month_date, 'YYYY-MM')
ORDER BY month
`, strings.Join(where, " AND "))
	var results []MonthlyPayrollBreakdown
	if err := db.SelectContext(ctx, &results, query, args...); err != nil {
		return nil, err
	}
	return results, nil
}

// FinancialSummary represents pending financial items
type FinancialPending struct {
	Count       int     `db:"count"`
	TotalAmount float64 `db:"total_amount"`
}

// GetPendingAdvances retrieves pending salary advances count and total
func (r *Repository) GetPendingAdvances(ctx context.Context, tenant contextx.TenantInfo) (*FinancialPending, error) {
	db := r.dbCtx(ctx)

	args := []interface{}{tenant.CompanyID}
	where := []string{
		"sa.deleted_at IS NULL",
		"sa.status = 'pending'",
		"e.company_id = $1",
	}

	if tenant.HasBranchID() {
		args = append(args, tenant.BranchID)
		where = append(where, fmt.Sprintf("e.branch_id = $%d", len(args)))
	}

	query := fmt.Sprintf(`
SELECT 
    COUNT(*) AS count,
    COALESCE(SUM(sa.amount), 0) AS total_amount
FROM salary_advance sa
JOIN employees e ON sa.employee_id = e.id
WHERE %s
`, strings.Join(where, " AND "))

	var result FinancialPending
	if err := db.GetContext(ctx, &result, query, args...); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetPendingLoans retrieves pending loans count and total
func (r *Repository) GetPendingLoans(ctx context.Context, tenant contextx.TenantInfo) (*FinancialPending, error) {
	db := r.dbCtx(ctx)

	args := []interface{}{tenant.CompanyID}
	where := []string{
		"dt.deleted_at IS NULL",
		"dt.status = 'pending'",
		"dt.txn_type IN ('loan', 'other')",
		"dt.parent_id IS NULL",
		"e.company_id = $1",
	}

	if tenant.HasBranchID() {
		args = append(args, tenant.BranchID)
		where = append(where, fmt.Sprintf("e.branch_id = $%d", len(args)))
	}

	query := fmt.Sprintf(`
SELECT 
    COUNT(*) AS count,
    COALESCE(SUM(dt.amount), 0) AS total_amount
FROM debt_txn dt
JOIN employees e ON dt.employee_id = e.id
WHERE %s
`, strings.Join(where, " AND "))

	var result FinancialPending
	if err := db.GetContext(ctx, &result, query, args...); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetOutstandingInstallments retrieves outstanding installments count and total
func (r *Repository) GetOutstandingInstallments(ctx context.Context, tenant contextx.TenantInfo) (*FinancialPending, error) {
	db := r.dbCtx(ctx)

	args := []interface{}{tenant.CompanyID}
	where := []string{
		"dt.deleted_at IS NULL",
		"dt.status = 'pending'",
		"dt.txn_type = 'installment'",
		"e.company_id = $1",
	}

	if tenant.HasBranchID() {
		args = append(args, tenant.BranchID)
		where = append(where, fmt.Sprintf("e.branch_id = $%d", len(args)))
	}

	query := fmt.Sprintf(`
SELECT 
    COUNT(*) AS count,
    COALESCE(SUM(dt.amount), 0) AS total_amount
FROM debt_txn dt
JOIN employees e ON dt.employee_id = e.id
WHERE %s
`, strings.Join(where, " AND "))

	var result FinancialPending
	if err := db.GetContext(ctx, &result, query, args...); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetPendingBonusCycles retrieves pending bonus cycles count and total
func (r *Repository) GetPendingBonusCycles(ctx context.Context, tenant contextx.TenantInfo) (*FinancialPending, error) {
	db := r.dbCtx(ctx)

	args := []interface{}{tenant.CompanyID}
	where := []string{
		"bc.deleted_at IS NULL",
		"bc.status = 'pending'",
		"bc.company_id = $1",
	}

	// Branch filter for branch-level pending
	if tenant.HasBranchID() {
		args = append(args, tenant.BranchID)
		where = append(where, fmt.Sprintf("bc.branch_id = $%d", len(args)))
	}

	query := fmt.Sprintf(`
SELECT 
    COUNT(DISTINCT bc.id) AS count,
    COALESCE(SUM(bi.bonus_amount), 0) AS total_amount
FROM bonus_cycle bc
LEFT JOIN bonus_item bi ON bc.id = bi.cycle_id
WHERE %s
`, strings.Join(where, " AND "))

	var result FinancialPending
	if err := db.GetContext(ctx, &result, query, args...); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetPendingSalaryRaiseCycles retrieves pending salary raise cycles count and total
func (r *Repository) GetPendingSalaryRaiseCycles(ctx context.Context, tenant contextx.TenantInfo) (*FinancialPending, error) {
	db := r.dbCtx(ctx)

	args := []interface{}{tenant.CompanyID}
	where := []string{
		"src.deleted_at IS NULL",
		"src.status = 'pending'",
		"src.company_id = $1",
	}

	// Branch filter for branch-level pending
	if tenant.HasBranchID() {
		args = append(args, tenant.BranchID)
		where = append(where, fmt.Sprintf("src.branch_id = $%d", len(args)))
	}

	query := fmt.Sprintf(`
SELECT 
    COUNT(DISTINCT src.id) AS count,
    COALESCE(SUM(sri.raise_amount), 0) AS total_amount
FROM salary_raise_cycle src
LEFT JOIN salary_raise_item sri ON src.id = sri.cycle_id
WHERE %s
`, strings.Join(where, " AND "))

	var result FinancialPending
	if err := db.GetContext(ctx, &result, query, args...); err != nil {
		return nil, err
	}
	return &result, nil
}

// TopEmployeeAttendance represents an employee's attendance ranking
type TopEmployeeAttendance struct {
	EmployeeID     uuid.UUID `db:"employee_id"`
	EmployeeNumber string    `db:"employee_number"`
	FullName       string    `db:"full_name"`
	PhotoID        *string   `db:"photo_id"`
	EntryType      string    `db:"entry_type"`
	TotalCount     int       `db:"total_count"`
	TotalQty       float64   `db:"total_qty"`
}

// GetTopEmployeesByAttendance retrieves top employees by attendance entry type
func (r *Repository) GetTopEmployeesByAttendance(ctx context.Context, tenant contextx.TenantInfo, startDate, endDate time.Time, limit int) ([]TopEmployeeAttendance, error) {
	db := r.dbCtx(ctx)

	if limit <= 0 {
		limit = 10
	}

	args := []interface{}{startDate, endDate}

	where := []string{
		"wl.deleted_at IS NULL",
		"wl.work_date >= $1",
		"wl.work_date <= $2",
	}

	// Company filter
	args = append(args, tenant.CompanyID)
	where = append(where, fmt.Sprintf("e.company_id = $%d", len(args)))

	// Branch filter
	if tenant.HasBranchID() {
		args = append(args, tenant.BranchID)
		where = append(where, fmt.Sprintf("e.branch_id = $%d", len(args)))
	}

	query := fmt.Sprintf(`
WITH ranked AS (
    SELECT 
        wl.employee_id,
        e.employee_number,
        CONCAT(COALESCE(pt.name_th, ''), e.first_name, ' ', e.last_name) AS full_name,
        e.photo_id,
        wl.entry_type,
        COUNT(*) AS total_count,
        COALESCE(SUM(wl.quantity), 0) AS total_qty,
        ROW_NUMBER() OVER (PARTITION BY wl.entry_type ORDER BY COUNT(*) DESC, COALESCE(SUM(wl.quantity), 0) DESC) AS rn
    FROM worklog_ft wl
    INNER JOIN employees e ON wl.employee_id = e.id AND e.deleted_at IS NULL
    LEFT JOIN person_title pt ON e.title_id = pt.id
    WHERE %s
    GROUP BY wl.employee_id, e.employee_number, e.first_name, e.last_name, pt.name_th, e.photo_id, wl.entry_type
)
SELECT employee_id, employee_number, full_name, photo_id, entry_type, total_count, total_qty
FROM ranked
WHERE rn <= %d
ORDER BY entry_type, rn
`, strings.Join(where, " AND "), limit)

	var results []TopEmployeeAttendance
	if err := db.SelectContext(ctx, &results, query, args...); err != nil {
		return nil, err
	}
	return results, nil
}
