package salaryraise

import (
	"hrms/modules/salaryraise/internal/feature/create"
	"hrms/modules/salaryraise/internal/feature/delete"
	"hrms/modules/salaryraise/internal/feature/get"
	itemslist "hrms/modules/salaryraise/internal/feature/items/list"
	itemsupdate "hrms/modules/salaryraise/internal/feature/items/update"
	"hrms/modules/salaryraise/internal/feature/list"
	"hrms/modules/salaryraise/internal/feature/update"
	"hrms/modules/salaryraise/internal/repository"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/jwt"
	"hrms/shared/common/mediator"
	"hrms/shared/common/middleware"
	"hrms/shared/common/module"
	"hrms/shared/common/registry"

	"github.com/gofiber/fiber/v3"
)

type Module struct {
	ctx        *module.ModuleContext
	repo       repository.Repository
	tenantRepo repository.TenantRepo
	tokenSvc   *jwt.TokenService
	eb         eventbus.EventBus
}

func NewModule(ctx *module.ModuleContext, tokenSvc *jwt.TokenService) *Module {
	repo := repository.NewRepository(ctx.DBCtx)
	return &Module{
		ctx:        ctx,
		repo:       repo,
		tenantRepo: repository.NewTenantRepo(repo),
		tokenSvc:   tokenSvc,
	}
}

func (m *Module) APIVersion() string { return "v1" }

func (m *Module) Init(_ registry.ServiceRegistry, eb eventbus.EventBus) error {
	m.eb = eb
	mediator.Register[*list.Query, *list.Response](list.NewHandler())
	mediator.Register[*get.Query, *get.Response](get.NewHandler())
	mediator.Register[*create.Command, *create.Response](create.NewHandler())
	mediator.Register[*update.Command, *update.Response](update.NewHandler())
	mediator.Register[*itemslist.Query, *itemslist.Response](itemslist.NewHandler())
	mediator.Register[*itemsupdate.Command, *itemsupdate.Response](itemsupdate.NewHandler())
	mediator.Register[*delete.Command, mediator.NoResponse](delete.NewHandler())
	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	group := r.Group("/salary-raise-cycles", middleware.Auth(m.tokenSvc), middleware.TenantMiddleware(m.tenantRepo), middleware.RequireRoles("admin", "hr"))
	list.NewEndpoint(group, m.repo)
	get.NewEndpoint(group, m.repo)
	create.NewEndpoint(group, m.repo, m.ctx.Transactor, m.eb)
	update.NewEndpoint(group, m.repo, m.eb)
	itemslist.NewEndpoint(group, m.repo)
	// items update (hr/admin)
	itemGroup := r.Group("/salary-raise-items", middleware.Auth(m.tokenSvc), middleware.TenantMiddleware(m.tenantRepo), middleware.RequireRoles("admin", "hr"))
	itemsupdate.NewEndpoint(itemGroup, m.repo, m.ctx.Transactor, m.eb)
	delete.NewEndpoint(group, m.repo, m.eb)
}
