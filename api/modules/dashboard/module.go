package dashboard

import (
	attendanceSummary "hrms/modules/dashboard/internal/feature/attendance_summary"
	attendanceTopEmployees "hrms/modules/dashboard/internal/feature/attendance_top_employees"
	employeeSummary "hrms/modules/dashboard/internal/feature/employee_summary"
	financialSummary "hrms/modules/dashboard/internal/feature/financial_summary"
	payrollSummary "hrms/modules/dashboard/internal/feature/payroll_summary"
	"hrms/modules/dashboard/internal/repository"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/jwt"
	"hrms/shared/common/mediator"
	"hrms/shared/common/middleware"
	"hrms/shared/common/module"

	"github.com/gofiber/fiber/v3"
)

type Module struct {
	ctx      *module.ModuleContext
	repo     *repository.Repository
	tokenSvc *jwt.TokenService
}

func NewModule(ctx *module.ModuleContext, tokenSvc *jwt.TokenService) *Module {
	repo := repository.NewRepository(ctx.DBCtx)
	return &Module{
		ctx:      ctx,
		repo:     repo,
		tokenSvc: tokenSvc,
	}
}

func (m *Module) APIVersion() string { return "v1" }

func (m *Module) Init(_ eventbus.EventBus) error {
	// Employee Summary
	mediator.Register[*employeeSummary.EmployeeSummaryQuery, *employeeSummary.EmployeeSummaryResponse](employeeSummary.NewEmployeeSummaryHandler(m.repo))

	// Attendance Summary
	mediator.Register[*attendanceSummary.AttendanceSummaryQuery, *attendanceSummary.AttendanceSummaryResponse](attendanceSummary.NewAttendanceSummaryHandler(m.repo))

	// Attendance Top Employees
	mediator.Register[*attendanceTopEmployees.AttendanceTopEmployeesQuery, *attendanceTopEmployees.AttendanceTopEmployeesResponse](attendanceTopEmployees.NewAttendanceTopEmployeesHandler(m.repo))

	// Payroll Summary
	mediator.Register[*payrollSummary.PayrollSummaryQuery, *payrollSummary.PayrollSummaryResponse](payrollSummary.NewPayrollSummaryHandler(m.repo))

	// Financial Summary
	mediator.Register[*financialSummary.FinancialSummaryQuery, *financialSummary.FinancialSummaryResponse](financialSummary.NewFinancialSummaryHandler(m.repo))

	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	// Allow admin, hr, and timekeeper roles to access dashboard endpoints
	group := r.Group("/dashboard", middleware.Auth(m.tokenSvc), middleware.TenantMiddleware(), middleware.RequireRoles("admin", "hr", "timekeeper"))

	employeeSummary.RegisterEmployeeSummary(group)
	attendanceSummary.RegisterAttendanceSummary(group)
	attendanceTopEmployees.RegisterAttendanceTopEmployees(group)
	payrollSummary.RegisterPayrollSummary(group)
	financialSummary.RegisterFinancialSummary(group)
}
