package payrollrun

import (
	"hrms/modules/payrollrun/internal/feature/create"
	"hrms/modules/payrollrun/internal/feature/delete"
	"hrms/modules/payrollrun/internal/feature/get"
	itemsget "hrms/modules/payrollrun/internal/feature/items/get"
	itemslist "hrms/modules/payrollrun/internal/feature/items/list"
	itemsupdate "hrms/modules/payrollrun/internal/feature/items/update"
	"hrms/modules/payrollrun/internal/feature/list"
	"hrms/modules/payrollrun/internal/feature/update"
	"hrms/modules/payrollrun/internal/repository"
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
	mediator.Register[*update.Command, *update.Response](update.NewHandler(m.repo, m.ctx.Transactor, m.eb))
	mediator.Register[*delete.Command, mediator.NoResponse](delete.NewHandler(m.repo, m.eb))
	mediator.Register[*itemslist.ListQuery, *itemslist.ListResponse](itemslist.NewListHandler(m.repo))
	mediator.Register[*itemsupdate.UpdateCommand, *itemsupdate.UpdateResponse](itemsupdate.NewUpdateHandler(m.repo, m.ctx.Transactor, m.eb))
	mediator.Register[*itemsget.GetQuery, *itemsget.GetResponse](itemsget.NewGetHandler(m.repo))
	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	runGroup := r.Group("/payroll-runs", middleware.Auth(m.tokenSvc), middleware.TenantMiddleware(), middleware.RequireRoles("admin", "hr"))
	list.NewEndpoint(runGroup)
	create.NewEndpoint(runGroup)
	get.NewEndpoint(runGroup)
	update.NewEndpoint(runGroup)
	// delete run = admin only
	delete.NewEndpoint(runGroup.Group("", middleware.RequireRoles("admin")))

	itemslist.NewEndpoint(runGroup)
	itemGroup := r.Group("/payroll-items", middleware.Auth(m.tokenSvc), middleware.TenantMiddleware(), middleware.RequireRoles("admin", "hr"))
	itemsget.NewEndpoint(itemGroup)
	itemsupdate.NewEndpoint(itemGroup)
}
