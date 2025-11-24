package auth

import (
	"hrms/modules/auth/internal/feature/login"
	"hrms/modules/auth/internal/feature/logout"
	"hrms/modules/auth/internal/feature/refresh"
	"hrms/modules/auth/internal/repository"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/jwt"
	"hrms/shared/common/mediator"
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
	mediator.Register[*login.Command, *login.Response](login.NewHandler(m.tokenSvc, m.repo, m.ctx.Transactor))
	mediator.Register[*refresh.Command, *refresh.Response](refresh.NewHandler(m.tokenSvc, m.repo, m.ctx.Transactor))
	mediator.Register[*logout.Command, mediator.NoResponse](logout.NewHandler(m.tokenSvc, m.repo))
	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	group := r.Group("/auth")
	login.NewEndpoint(group)
	refresh.NewEndpoint(group)
	logout.NewEndpoint(group)
}
