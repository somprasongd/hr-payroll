package branch

import (
	"hrms/modules/branch/internal/feature"
	"hrms/modules/branch/internal/repository"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/jwt"
	cmw "hrms/shared/common/middleware"
	"hrms/shared/common/module"
	"hrms/shared/common/registry"

	"github.com/gofiber/fiber/v3"
)

type Module struct {
	ctx      *module.ModuleContext
	repo     repository.Repository
	tokenSvc *jwt.TokenService
	eb       eventbus.EventBus
}

func NewModule(ctx *module.ModuleContext, tokenSvc *jwt.TokenService) *Module {
	return &Module{
		ctx:      ctx,
		repo:     repository.NewRepository(ctx.DBCtx),
		tokenSvc: tokenSvc,
	}
}

func (m *Module) APIVersion() string { return "v1" }

func (m *Module) Init(_ registry.ServiceRegistry, eb eventbus.EventBus) error {
	m.eb = eb
	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	// Admin routes - requires auth and admin role
	admin := r.Group(
		"/admin/branches",
		cmw.Auth(m.tokenSvc),
		cmw.RequireRoles("admin"),
		cmw.TenantMiddleware(m.repo),
	)
	feature.Register(admin, m.repo, m.eb)
}

// GetRepository returns the repository for use by tenant middleware
func (m *Module) GetRepository() repository.Repository {
	return m.repo
}
