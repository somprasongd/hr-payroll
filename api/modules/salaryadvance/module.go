package salaryadvance

import (
	"hrms/modules/salaryadvance/internal/feature/create"
	"hrms/modules/salaryadvance/internal/feature/delete"
	"hrms/modules/salaryadvance/internal/feature/get"
	"hrms/modules/salaryadvance/internal/feature/list"
	"hrms/modules/salaryadvance/internal/feature/update"
	"hrms/modules/salaryadvance/internal/repository"
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
	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	group := r.Group("/salary-advances", middleware.Auth(m.tokenSvc))
	list.NewEndpoint(group)
	get.NewEndpoint(group)
	create.NewEndpoint(group)
	update.NewEndpoint(group)
	delete.NewEndpoint(group)
}
