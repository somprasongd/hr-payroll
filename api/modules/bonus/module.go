package bonus

import (
	"hrms/modules/bonus/internal/feature/approve"
	"hrms/modules/bonus/internal/feature/create"
	"hrms/modules/bonus/internal/feature/delete"
	"hrms/modules/bonus/internal/feature/get"
	"hrms/modules/bonus/internal/feature/items"
	"hrms/modules/bonus/internal/feature/list"
	"hrms/modules/bonus/internal/repository"
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

func (m *Module) Init(_ registry.ServiceRegistry, eb eventbus.EventBus) error {
	m.eb = eb
	mediator.Register[*list.Query, *list.Response](list.NewHandler())
	mediator.Register[*get.Query, *get.Response](get.NewHandler())
	mediator.Register[*create.Command, *create.Response](create.NewHandler())
	mediator.Register[*approve.Command, *approve.Response](approve.NewHandler())
	mediator.Register[*items.ListQuery, *items.ListResponse](items.NewListHandler())
	mediator.Register[*items.UpdateCommand, *items.UpdateResponse](items.NewUpdateHandler())
	mediator.Register[*delete.Command, mediator.NoResponse](delete.NewHandler())
	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	group := r.Group("/bonus-cycles", middleware.Auth(m.tokenSvc), middleware.RequireRoles("admin", "hr"))
	list.NewEndpoint(group, m.repo)
	get.NewEndpoint(group, m.repo)
	create.NewEndpoint(group, m.repo, m.ctx.Transactor, m.eb)
	items.RegisterList(group, m.repo)

	itemGroup := r.Group("/bonus-items", middleware.Auth(m.tokenSvc), middleware.RequireRoles("admin", "hr"))
	items.RegisterUpdate(itemGroup, m.repo)

	admin := group.Group("", middleware.RequireRoles("admin"))
	approve.NewEndpoint(admin, m.repo, m.ctx.Transactor, m.eb)
	delete.NewEndpoint(group, m.repo, m.eb)
}
