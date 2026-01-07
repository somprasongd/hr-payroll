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

	"github.com/gofiber/fiber/v3"
)

type Module struct {
	ctx      *module.ModuleContext
	repo     repository.Repository
	tokenSvc *jwt.TokenService
	eb       eventbus.EventBus
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

func (m *Module) Init(eb eventbus.EventBus) error {
	m.eb = eb
	mediator.Register[*list.Query, *list.Response](list.NewHandler(m.repo))
	mediator.Register[*get.Query, *get.Response](get.NewHandler(m.repo))
	mediator.Register[*create.Command, *create.Response](create.NewHandler(m.repo, m.ctx.Transactor, m.eb))
	mediator.Register[*approve.Command, *approve.Response](approve.NewHandler(m.repo, m.ctx.Transactor, m.eb))
	mediator.Register[*items.ListQuery, *items.ListResponse](items.NewListHandler(m.repo))
	mediator.Register[*items.UpdateCommand, *items.UpdateResponse](items.NewUpdateHandler(m.repo, m.eb))
	mediator.Register[*delete.Command, mediator.NoResponse](delete.NewHandler(m.repo, m.eb))
	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	group := r.Group("/bonus-cycles", middleware.Auth(m.tokenSvc), middleware.TenantMiddleware(), middleware.RequireRoles("admin", "hr"))
	list.NewEndpoint(group)
	get.NewEndpoint(group)
	create.NewEndpoint(group)
	items.RegisterList(group)

	itemGroup := r.Group("/bonus-items", middleware.Auth(m.tokenSvc), middleware.TenantMiddleware(), middleware.RequireRoles("admin", "hr"))
	items.RegisterUpdate(itemGroup)

	admin := group.Group("", middleware.RequireRoles("admin"))
	approve.NewEndpoint(admin)
	delete.NewEndpoint(group)
}
