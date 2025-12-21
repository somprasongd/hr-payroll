package activitylog

import (
	"hrms/modules/activitylog/internal/feature/filteroptions"
	"hrms/modules/activitylog/internal/feature/list"
	"hrms/modules/activitylog/internal/feature/superadminfilteroptions"
	"hrms/modules/activitylog/internal/feature/superadminlist"
	"hrms/modules/activitylog/internal/repository"
	"hrms/modules/activitylog/internal/subscriber"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/jwt"
	"hrms/shared/common/mediator"
	"hrms/shared/common/middleware"
	"hrms/shared/common/module"

	"github.com/gofiber/fiber/v3"
)

type Module struct {
	ctx      *module.ModuleContext
	tokenSvc *jwt.TokenService
	repo     *repository.Repository
}

func NewModule(ctx *module.ModuleContext, tokenSvc *jwt.TokenService) *Module {
	repo := repository.NewRepository(ctx.DBCtx)
	return &Module{
		ctx:      ctx,
		tokenSvc: tokenSvc,
		repo:     repo,
	}
}

func (m *Module) APIVersion() string {
	return "v1"
}

func (m *Module) Init(eb eventbus.EventBus) error {
	// Register handlers with mediator
	mediator.Register[*list.Query, *list.Response](list.NewHandler())
	mediator.Register[*filteroptions.Query, *filteroptions.Response](filteroptions.NewHandler())

	// Super admin handlers
	mediator.Register[*superadminlist.Query, *superadminlist.Response](superadminlist.NewHandler())
	mediator.Register[*superadminfilteroptions.Query, *superadminfilteroptions.Response](superadminfilteroptions.NewHandler())

	// Subscribe to events
	sub := subscriber.NewLogSubscriber(m.repo)
	eb.Subscribe("LogEvent", sub.HandleLogActivity)

	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	// Admin only
	g := r.Group("/admin/activity-logs", middleware.Auth(m.tokenSvc), middleware.TenantMiddleware(), middleware.RequireRoles("admin"))
	list.NewEndpoint(g, m.repo)
	filteroptions.NewEndpoint(g, m.repo)

	// Super admin only (no TenantMiddleware - for system-level logs)
	sa := r.Group("/super-admin/activity-logs", middleware.Auth(m.tokenSvc), middleware.RequireRoles("superadmin"))
	superadminlist.NewEndpoint(sa, m.repo)
	superadminfilteroptions.NewEndpoint(sa, m.repo)
}
