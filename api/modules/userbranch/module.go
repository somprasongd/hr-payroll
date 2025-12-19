package userbranch

import (
	"hrms/modules/userbranch/internal/feature/getbranches"
	"hrms/modules/userbranch/internal/feature/listusers"
	"hrms/modules/userbranch/internal/feature/setbranches"
	"hrms/modules/userbranch/internal/repository"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/jwt"
	"hrms/shared/common/mediator"
	cmw "hrms/shared/common/middleware"
	"hrms/shared/common/module"

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

func (m *Module) Init(_ eventbus.EventBus) error {
	// Register handlers with mediator
	mediator.Register[*listusers.Query, *listusers.Response](listusers.NewHandler())
	mediator.Register[*getbranches.Query, *getbranches.Response](getbranches.NewHandler())
	mediator.Register[*setbranches.Command, *setbranches.Response](setbranches.NewHandler())

	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	admin := r.Group(
		"/admin/users",
		cmw.Auth(m.tokenSvc),
		cmw.RequireRoles("admin"),
		cmw.TenantMiddleware(),
	)

	// Register CQRS endpoints
	listusers.NewEndpoint(admin, m.repo)
	getbranches.NewEndpoint(admin, m.repo)
	setbranches.NewEndpoint(admin, m.repo)
}
