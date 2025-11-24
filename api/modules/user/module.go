package user

import (
	"hrms/modules/user/internal/feature/changepassword"
	"hrms/modules/user/internal/feature/create"
	"hrms/modules/user/internal/feature/delete"
	"hrms/modules/user/internal/feature/get"
	"hrms/modules/user/internal/feature/list"
	"hrms/modules/user/internal/feature/me"
	"hrms/modules/user/internal/feature/resetpassword"
	"hrms/modules/user/internal/feature/updaterole"
	"hrms/modules/user/internal/repository"
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
	tokenSvc *jwt.TokenService
	repo     repository.Repository
}

func NewModule(ctx *module.ModuleContext, tokenSvc *jwt.TokenService) *Module {
	return &Module{
		ctx:      ctx,
		tokenSvc: tokenSvc,
		repo:     repository.NewRepository(ctx.DBCtx),
	}
}

func (m *Module) APIVersion() string {
	return "v1"
}

func (m *Module) Init(_ registry.ServiceRegistry, _ eventbus.EventBus) error {
	mediator.Register[*list.Query, *list.Response](list.NewHandler(m.repo))
	mediator.Register[*create.Command, *create.Response](create.NewHandler(m.repo, m.ctx.Transactor))
	mediator.Register[*get.Query, *get.Response](get.NewHandler(m.repo))
	mediator.Register[*updaterole.Command, *updaterole.Response](updaterole.NewHandler(m.repo))
	mediator.Register[*resetpassword.Command, *resetpassword.Response](resetpassword.NewHandler(m.repo))
	mediator.Register[*delete.Command, mediator.NoResponse](delete.NewHandler(m.repo))
	mediator.Register[*me.Query, *me.Response](me.NewHandler(m.repo))
	mediator.Register[*changepassword.Command, *changepassword.Response](changepassword.NewHandler(m.repo))
	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	protected := r.Group("", middleware.Auth(m.tokenSvc))

	admin := protected.Group("/admin", middleware.RequireRoles("admin"))
	list.NewEndpoint(admin)
	create.NewEndpoint(admin)
	get.NewEndpoint(admin)
	updaterole.NewEndpoint(admin)
	resetpassword.NewEndpoint(admin)
	delete.NewEndpoint(admin)

	meGroup := protected.Group("/me")
	me.NewEndpoint(meGroup)
	changepassword.NewEndpoint(meGroup)
}
