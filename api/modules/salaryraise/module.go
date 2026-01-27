package salaryraise

import (
	"hrms/modules/salaryraise/internal/feature/create"
	"hrms/modules/salaryraise/internal/feature/cyclemgmt"
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
	mediator.Register[*list.Query, *list.Response](list.NewHandler(m.repo))
	mediator.Register[*get.Query, *get.Response](get.NewHandler(m.repo))
	mediator.Register[*create.Command, *create.Response](create.NewHandler(m.repo, m.ctx.Transactor, eb))
	mediator.Register[*update.Command, *update.Response](update.NewHandler(m.repo, m.eb))
	mediator.Register[*itemslist.Query, *itemslist.Response](itemslist.NewHandler(m.repo))
	mediator.Register[*itemsupdate.Command, *itemsupdate.Response](itemsupdate.NewHandler(m.repo, eb))
	mediator.Register[*delete.Command, mediator.NoResponse](delete.NewHandler(m.repo, eb))

	// Contract handlers for cross-module communication
	mediator.Register[*contracts.AddToSalaryRaiseCycleCommand, *contracts.AddToSalaryRaiseCycleResponse](cyclemgmt.NewAddHandler(m.repo))
	mediator.Register[*contracts.RemoveFromSalaryRaiseCycleCommand, *contracts.RemoveFromSalaryRaiseCycleResponse](cyclemgmt.NewRemoveHandler(m.repo))

	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	group := r.Group("/salary-raise-cycles", middleware.Auth(m.tokenSvc), middleware.TenantMiddleware(), middleware.RequireRoles("admin", "hr"))
	list.NewEndpoint(group)
	get.NewEndpoint(group)
	create.NewEndpoint(group)
	update.NewEndpoint(group)
	itemslist.NewEndpoint(group)
	// items update (hr/admin)
	itemGroup := r.Group("/salary-raise-items", middleware.Auth(m.tokenSvc), middleware.TenantMiddleware(), middleware.RequireRoles("admin", "hr"))
	itemsupdate.NewEndpoint(itemGroup)
	delete.NewEndpoint(group)
}
