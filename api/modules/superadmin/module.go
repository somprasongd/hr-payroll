package superadmin

import (
	"hrms/modules/superadmin/internal/feature/company"
	"hrms/modules/superadmin/internal/repository"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/jwt"
	"hrms/shared/common/middleware"
	"hrms/shared/common/module"
	"hrms/shared/common/registry"
	"hrms/shared/common/storage/sqldb/transactor"

	"github.com/gofiber/fiber/v3"
)

// Module handles super admin functionality
type Module struct {
	ctx      *module.ModuleContext
	repo     repository.Repository
	tokenSvc *jwt.TokenService
	tx       transactor.Transactor
}

// NewModule creates a new super admin module
func NewModule(ctx *module.ModuleContext, tokenSvc *jwt.TokenService, tx transactor.Transactor) *Module {
	return &Module{
		ctx:      ctx,
		repo:     repository.New(ctx.DBCtx),
		tokenSvc: tokenSvc,
		tx:       tx,
	}
}

func (m *Module) APIVersion() string { return "v1" }

func (m *Module) Init(_ registry.ServiceRegistry, _ eventbus.EventBus) error {
	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	// Super admin routes - requires auth and superadmin role
	superAdmin := r.Group("/super-admin", middleware.Auth(m.tokenSvc), middleware.RequireRoles("superadmin"))

	// Company management
	companyHandler := company.NewHandler(m.repo, m.tx)
	superAdmin.Get("/companies", companyHandler.List)
	superAdmin.Post("/companies", companyHandler.Create)
	superAdmin.Get("/companies/:id", companyHandler.Get)
	superAdmin.Patch("/companies/:id", companyHandler.Update)
}
