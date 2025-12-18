package masterdata

import (
	"hrms/modules/masterdata/internal/feature"
	"hrms/modules/masterdata/internal/feature/department"
	"hrms/modules/masterdata/internal/feature/employeeposition"
	"hrms/modules/masterdata/internal/repository"
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
	mediator.Register[*feature.Query, *feature.Response](feature.NewHandler(m.repo))
	mediator.Register[*department.CreateCommand, *department.Response](department.NewCreateHandler(m.repo, eb))
	mediator.Register[*department.UpdateCommand, *department.Response](department.NewUpdateHandler(m.repo, eb))
	mediator.Register[*department.DeleteCommand, mediator.NoResponse](department.NewDeleteHandler(m.repo, eb))
	mediator.Register[*employeeposition.CreateCommand, *employeeposition.Response](employeeposition.NewCreateHandler(m.repo, eb))
	mediator.Register[*employeeposition.UpdateCommand, *employeeposition.Response](employeeposition.NewUpdateHandler(m.repo, eb))
	mediator.Register[*employeeposition.DeleteCommand, mediator.NoResponse](employeeposition.NewDeleteHandler(m.repo, eb))
	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	group := r.Group("/master", middleware.Auth(m.tokenSvc), middleware.TenantMiddleware(m.tenantRepo))
	feature.Register(group)
}
