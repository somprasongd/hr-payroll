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
	"hrms/shared/common/registry"

	"github.com/gofiber/fiber/v3"
)

type Module struct {
	ctx      *module.ModuleContext
	repo     repository.Repository
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
	mediator.Register[*list.Query, *list.Response](list.NewHandler(m.repo))
	mediator.Register[*effective.Query, *effective.Response](effective.NewHandler(m.repo))
	mediator.Register[*create.Command, *create.Response](create.NewHandler(m.repo, m.ctx.Transactor))
	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	admin := r.Group("/admin/payroll-configs", middleware.Auth(m.tokenSvc), middleware.RequireRoles("admin"))
	list.NewEndpoint(admin)
	effective.NewEndpoint(admin)
	create.NewEndpoint(admin)
}
