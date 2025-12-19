package payrollconfig

import (
	"hrms/modules/payrollconfig/internal/feature/create"
	"hrms/modules/payrollconfig/internal/feature/effective"
	"hrms/modules/payrollconfig/internal/feature/list"
	"hrms/modules/payrollconfig/internal/repository"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/jwt"
	"hrms/shared/common/mediator"
	"hrms/shared/common/middleware"
	"hrms/shared/common/module"

	"github.com/gofiber/fiber/v3"
)

type Module struct {
	ctx      *module.ModuleContext
	repo     repository.Repository
	tokenSvc *jwt.TokenService
	eb       eventbus.EventBus
}

func NewModule(ctx *module.ModuleContext, tokenSvc *jwt.TokenService) *Module {
	return &Module{
		ctx:      ctx,
		repo:     repository.NewRepository(ctx.DBCtx),
		tokenSvc: tokenSvc,
	}
}

func (m *Module) APIVersion() string { return "v1" }

func (m *Module) Init(eb eventbus.EventBus) error {
	m.eb = eb
	mediator.Register[*list.Query, *list.Response](list.NewHandler(m.repo))
	mediator.Register[*effective.Query, *effective.Response](effective.NewHandler(m.repo))
	mediator.Register[*create.Command, *create.Response](create.NewHandler(m.repo, m.ctx.Transactor, eb))
	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	group := r.Group("/admin/payroll-configs", middleware.Auth(m.tokenSvc))
	adminOrHR := group.Group("", middleware.RequireRoles("admin", "hr"))
	effective.NewEndpoint(adminOrHR)

	admin := group.Group("", middleware.RequireRoles("admin"))
	list.NewEndpoint(admin)
	create.NewEndpoint(admin)
}
