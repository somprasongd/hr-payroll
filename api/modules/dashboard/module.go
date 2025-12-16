package dashboard

import (
	"hrms/modules/dashboard/internal/feature"
	"hrms/modules/dashboard/internal/repository"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/jwt"
	"hrms/shared/common/mediator"
	"hrms/shared/common/middleware"
	"hrms/shared/common/module"
	"hrms/shared/common/registry"

	"github.com/gofiber/fiber/v3"
)

type Module struct {
	ctx      *module.ModuleContext
	repo     *repository.Repository
	tokenSvc *jwt.TokenService
}

func NewModule(ctx *module.ModuleContext, tokenSvc *jwt.TokenService) *Module {
	return &Module{
		ctx:      ctx,
		repo:     repository.NewRepository(ctx.DBCtx),
		tokenSvc: tokenSvc,
	}
}

func (m *Module) APIVersion() string { return "v1" }

func (m *Module) Init(_ registry.ServiceRegistry, _ eventbus.EventBus) error {
	// Employee Summary
	mediator.Register[*feature.EmployeeSummaryQuery, *feature.EmployeeSummaryResponse](feature.NewEmployeeSummaryHandler())

	// Attendance Summary
	mediator.Register[*feature.AttendanceSummaryQuery, *feature.AttendanceSummaryResponse](feature.NewAttendanceSummaryHandler())

	// Payroll Summary
	mediator.Register[*feature.PayrollSummaryQuery, *feature.PayrollSummaryResponse](feature.NewPayrollSummaryHandler())

	// Financial Summary
	mediator.Register[*feature.FinancialSummaryQuery, *feature.FinancialSummaryResponse](feature.NewFinancialSummaryHandler())

	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	group := r.Group("/dashboard", middleware.Auth(m.tokenSvc))

	feature.RegisterEmployeeSummary(group, m.repo)
	feature.RegisterAttendanceSummary(group, m.repo)
	feature.RegisterPayrollSummary(group, m.repo)
	feature.RegisterFinancialSummary(group, m.repo)
}
