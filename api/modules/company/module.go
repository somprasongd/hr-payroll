package company

import (
	"hrms/modules/company/internal/feature"
	"hrms/modules/company/internal/repository"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/jwt"
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
	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	admin := r.Group("/admin/company", middleware.Auth(m.tokenSvc), middleware.RequireRoles("admin"))
	feature.Register(admin, m.repo)
}
