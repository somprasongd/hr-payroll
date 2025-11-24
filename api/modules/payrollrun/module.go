package payrollrun

import (
	"hrms/modules/payrollrun/internal/feature/create"
	"hrms/modules/payrollrun/internal/feature/delete"
	"hrms/modules/payrollrun/internal/feature/get"
	"hrms/modules/payrollrun/internal/feature/items"
	"hrms/modules/payrollrun/internal/feature/list"
	"hrms/modules/payrollrun/internal/feature/update"
	"hrms/modules/payrollrun/internal/repository"
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
	mediator.Register[*list.Query, *list.Response](list.NewHandler())
	mediator.Register[*get.Query, *get.Response](get.NewHandler())
	mediator.Register[*create.Command, *create.Response](create.NewHandler())
	mediator.Register[*update.Command, *update.Response](update.NewHandler())
	mediator.Register[*delete.Command, mediator.NoResponse](delete.NewHandler())
	mediator.Register[*items.ListQuery, *items.ListResponse](items.NewListHandler())
	mediator.Register[*items.UpdateCommand, *items.UpdateResponse](items.NewUpdateHandler())
	mediator.Register[*items.GetQuery, *items.GetResponse](items.NewGetHandler())
	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	runGroup := r.Group("/payroll-runs", middleware.Auth(m.tokenSvc), middleware.RequireRoles("admin", "hr"))
	list.NewEndpoint(runGroup, m.repo)
	create.NewEndpoint(runGroup, m.repo, m.ctx.Transactor)
	get.NewEndpoint(runGroup, m.repo)
	update.NewEndpoint(runGroup, m.repo, m.ctx.Transactor)
	// delete run = admin only
	delete.NewEndpoint(runGroup.Group("", middleware.RequireRoles("admin")), m.repo)

	items.Register(runGroup, r.Group("/payroll-items", middleware.Auth(m.tokenSvc), middleware.RequireRoles("admin", "hr")), m.repo, m.ctx.Transactor)
}
