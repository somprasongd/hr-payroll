package masterdata

import (
	"hrms/modules/masterdata/internal/feature"
	"hrms/modules/masterdata/internal/feature/bank"
	"hrms/modules/masterdata/internal/feature/department"
	"hrms/modules/masterdata/internal/feature/employeeposition"
	"hrms/modules/masterdata/internal/feature/list"
	"hrms/modules/masterdata/internal/repository"
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
	mediator.Register[*department.CreateCommand, *department.Response](department.NewCreateHandler(m.repo, eb))
	mediator.Register[*department.UpdateCommand, *department.Response](department.NewUpdateHandler(m.repo, eb))
	mediator.Register[*department.DeleteCommand, mediator.NoResponse](department.NewDeleteHandler(m.repo, eb))
	mediator.Register[*employeeposition.CreateCommand, *employeeposition.Response](employeeposition.NewCreateHandler(m.repo, eb))
	mediator.Register[*employeeposition.UpdateCommand, *employeeposition.Response](employeeposition.NewUpdateHandler(m.repo, eb))
	mediator.Register[*employeeposition.DeleteCommand, mediator.NoResponse](employeeposition.NewDeleteHandler(m.repo, eb))
	// Bank handlers
	mediator.Register[*bank.ListQuery, *bank.ListResponse](bank.NewListHandler(m.repo))
	mediator.Register[*bank.ListSystemBanksQuery, *bank.ListSystemBanksResponse](bank.NewListSystemBanksHandler(m.repo))
	mediator.Register[*bank.CreateCommand, *bank.Response](bank.NewCreateHandler(m.repo, eb))
	mediator.Register[*bank.UpdateCommand, *bank.Response](bank.NewUpdateHandler(m.repo, eb))
	mediator.Register[*bank.DeleteCommand, mediator.NoResponse](bank.NewDeleteHandler(m.repo, eb))
	mediator.Register[*bank.ToggleCommand, mediator.NoResponse](bank.NewToggleHandler(m.repo, eb))
	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	group := r.Group("/master", middleware.Auth(m.tokenSvc), middleware.TenantMiddleware())
	feature.Register(group)
}

func (m *Module) RegisterSuperAdminRoutes(r fiber.Router) {
	group := r.Group("/master", middleware.Auth(m.tokenSvc), middleware.RequireRoles("superadmin"))
	feature.RegisterSystemBanks(group)
}
