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
	mediator.Register[*feature.Query, *feature.Response](feature.NewHandler(m.repo))
	mediator.Register[*department.CreateCommand, *department.Response](department.NewCreateHandler(m.repo))
	mediator.Register[*department.UpdateCommand, *department.Response](department.NewUpdateHandler(m.repo))
	mediator.Register[*department.DeleteCommand, mediator.NoResponse](department.NewDeleteHandler(m.repo))
	mediator.Register[*employeeposition.CreateCommand, *employeeposition.Response](employeeposition.NewCreateHandler(m.repo))
	mediator.Register[*employeeposition.UpdateCommand, *employeeposition.Response](employeeposition.NewUpdateHandler(m.repo))
	mediator.Register[*employeeposition.DeleteCommand, mediator.NoResponse](employeeposition.NewDeleteHandler(m.repo))
	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	group := r.Group("/master", middleware.Auth(m.tokenSvc))
	feature.Register(group)
}
