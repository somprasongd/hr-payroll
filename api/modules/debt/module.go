package debt

import (
	"hrms/modules/debt/internal/feature/approve"
	"hrms/modules/debt/internal/feature/createplan"
	"hrms/modules/debt/internal/feature/delete"
	"hrms/modules/debt/internal/feature/get"
	"hrms/modules/debt/internal/feature/list"
	"hrms/modules/debt/internal/feature/outstanding"
	"hrms/modules/debt/internal/feature/repayment"
	"hrms/modules/debt/internal/repository"
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
	mediator.Register[*createplan.Command, *createplan.Response](createplan.NewHandler(m.repo, m.ctx.Transactor))
	mediator.Register[*approve.Command, *approve.Response](approve.NewHandler(m.repo, m.ctx.Transactor))
	mediator.Register[*repayment.Command, *repayment.Response](repayment.NewHandler(m.repo, m.ctx.Transactor))
	mediator.Register[*delete.Command, mediator.NoResponse](delete.NewHandler(m.repo))
	mediator.Register[*outstanding.Query, *outstanding.Response](outstanding.NewHandler(m.repo))
	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	group := r.Group("/debt-txns", middleware.Auth(m.tokenSvc))
	// shared (admin, hr)
	list.NewEndpoint(group)
	createplan.NewEndpoint(group)
	get.NewEndpoint(group)
	repayment.NewEndpoint(group)
	delete.NewEndpoint(group)
	outstanding.NewEndpoint(group)

	// admin only
	admin := group.Group("", middleware.RequireRoles("admin"))
	approve.NewEndpoint(admin)
}
