package payoutpt

import (
	"hrms/modules/payoutpt/internal/feature/cancel"
	"hrms/modules/payoutpt/internal/feature/create"
	"hrms/modules/payoutpt/internal/feature/get"
	"hrms/modules/payoutpt/internal/feature/haspending"
	"hrms/modules/payoutpt/internal/feature/list"
	"hrms/modules/payoutpt/internal/feature/pay"
	"hrms/modules/payoutpt/internal/repository"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/jwt"
	"hrms/shared/common/mediator"
	"hrms/shared/common/middleware"
	"hrms/shared/common/module"
	"hrms/shared/contracts"

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
	mediator.Register[*create.Command, *create.Response](create.NewHandler(m.repo, m.ctx.Transactor, eb))
	mediator.Register[*list.Query, *list.Response](list.NewHandler(m.repo))
	mediator.Register[*get.Query, *get.Response](get.NewHandler(m.repo))
	mediator.Register[*pay.Command, *pay.Response](pay.NewHandler(m.repo, m.ctx.Transactor, eb))
	mediator.Register[*cancel.Command, mediator.NoResponse](cancel.NewHandler(m.repo, eb))

	// Contract handlers for cross-module communication
	mediator.Register[*contracts.HasPendingPayoutPTQuery, *contracts.HasPendingPayoutPTResponse](haspending.NewHandler(m.repo))

	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	group := r.Group("/payouts/pt", middleware.Auth(m.tokenSvc), middleware.TenantMiddleware(), middleware.RequireRoles("admin", "hr"))
	create.NewEndpoint(group)
	list.NewEndpoint(group)
	get.NewEndpoint(group)
	cancel.NewEndpoint(group)
	// pay admin only
	admin := group.Group("", middleware.RequireRoles("admin"))
	pay.NewEndpoint(admin)
}
