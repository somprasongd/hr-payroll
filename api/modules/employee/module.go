package employee

import (
	accdelete "hrms/modules/employee/internal/feature/accum/delete"
	acclist "hrms/modules/employee/internal/feature/accum/list"
	accupsert "hrms/modules/employee/internal/feature/accum/upsert"
	"hrms/modules/employee/internal/feature/create"
	"hrms/modules/employee/internal/feature/delete"
	"hrms/modules/employee/internal/feature/get"
	"hrms/modules/employee/internal/feature/list"
	"hrms/modules/employee/internal/feature/update"
	"hrms/modules/employee/internal/repository"
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
	mediator.Register[*get.Query, *get.Response](get.NewHandler(m.repo))
	mediator.Register[*create.Command, *create.Response](create.NewHandler(m.repo, m.ctx.Transactor))
	mediator.Register[*update.Command, *update.Response](update.NewHandler(m.repo, m.ctx.Transactor))
	mediator.Register[*delete.Command, mediator.NoResponse](delete.NewHandler(m.repo))
	mediator.Register[*acclist.Query, *acclist.Response](acclist.NewHandler(m.repo))
	mediator.Register[*accupsert.Command, *accupsert.Response](accupsert.NewHandler(m.repo))
	mediator.Register[*accdelete.Command, mediator.NoResponse](accdelete.NewHandler(m.repo))
	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	group := r.Group("/employees", middleware.Auth(m.tokenSvc))
	// Staff & Admin
	list.NewEndpoint(group)
	create.NewEndpoint(group)
	get.NewEndpoint(group)
	update.NewEndpoint(group)
	// Admin & HR
	adminOrHR := group.Group("", middleware.RequireRoles("admin", "hr"))
	delete.NewEndpoint(adminOrHR)
	acclist.NewEndpoint(adminOrHR)
	// Admin only (mutations)
	admin := group.Group("", middleware.RequireRoles("admin"))
	accupsert.NewEndpoint(admin)
	accdelete.NewEndpoint(admin)
}
