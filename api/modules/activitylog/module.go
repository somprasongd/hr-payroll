package activitylog

import (
	"hrms/modules/activitylog/internal/repository"
	"hrms/modules/activitylog/internal/subscriber"
	"hrms/modules/activitylog/internal/transport/http"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/jwt"
	"hrms/shared/common/middleware"
	"hrms/shared/common/module"
	"hrms/shared/common/registry"

	"github.com/gofiber/fiber/v3"
)

type Module struct {
	ctx        *module.ModuleContext
	tokenSvc   *jwt.TokenService
	repo       *repository.Repository
	tenantRepo repository.TenantRepo
}

func NewModule(ctx *module.ModuleContext, tokenSvc *jwt.TokenService) *Module {
	repo := repository.NewRepository(ctx.DBCtx)
	return &Module{
		ctx:        ctx,
		tokenSvc:   tokenSvc,
		repo:       repo,
		tenantRepo: repository.NewTenantRepo(repo),
	}
}

func (m *Module) APIVersion() string {
	return "v1"
}

func (m *Module) Init(_ registry.ServiceRegistry, eb eventbus.EventBus) error {
	sub := subscriber.NewLogSubscriber(m.repo)

	eb.Subscribe("LogEvent", sub.HandleLogActivity)

	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	handler := http.NewHandler(m.repo)

	// Admin only
	g := r.Group("/admin/activity-logs", middleware.Auth(m.tokenSvc), middleware.TenantMiddleware(m.tenantRepo), middleware.RequireRoles("admin"))
	g.Get("/", handler.ListLogs)
	g.Get("/latest", handler.ListLogs)
	g.Get("/filter-options", handler.GetFilterOptions)
}
