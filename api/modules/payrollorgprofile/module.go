package payrollorgprofile

import (
	"hrms/modules/payrollorgprofile/internal/feature/create"
	"hrms/modules/payrollorgprofile/internal/feature/downloadlogo"
	"hrms/modules/payrollorgprofile/internal/feature/effective"
	"hrms/modules/payrollorgprofile/internal/feature/get"
	"hrms/modules/payrollorgprofile/internal/feature/list"
	"hrms/modules/payrollorgprofile/internal/feature/metalogo"
	"hrms/modules/payrollorgprofile/internal/feature/uploadlogo"
	"hrms/modules/payrollorgprofile/internal/repository"
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
	return &Module{
		ctx:      ctx,
		repo:     repository.NewRepository(ctx.DBCtx),
		tokenSvc: tokenSvc,
	}
}

func (m *Module) APIVersion() string { return "v1" }

func (m *Module) Init(eb eventbus.EventBus) error {
	m.eb = eb
	mediator.Register[*list.Query, *list.Response](list.NewHandler(m.repo))
	mediator.Register[*get.Query, *get.Response](get.NewHandler(m.repo))
	mediator.Register[*effective.Query, *effective.Response](effective.NewHandler(m.repo))
	mediator.Register[*create.Command, *create.Response](create.NewHandler(m.repo, m.ctx.Transactor, eb))
	mediator.Register[*uploadlogo.Command, *uploadlogo.Response](uploadlogo.NewHandler(m.repo, eb))
	mediator.Register[*downloadlogo.Query, *downloadlogo.Response](downloadlogo.NewHandler(m.repo))
	mediator.Register[*metalogo.Query, *metalogo.Response](metalogo.NewHandler(m.repo))
	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	admin := r.Group(
		"/admin/payroll-org-profiles",
		middleware.Auth(m.tokenSvc),
		middleware.RequireRoles("admin"),
		middleware.TenantMiddleware(),
	)
	list.NewEndpoint(admin)
	effective.NewEndpoint(admin)
	get.NewEndpoint(admin)
	create.NewEndpoint(admin)

	logo := r.Group(
		"/admin/payroll-org-logos",
		middleware.Auth(m.tokenSvc),
		middleware.RequireRoles("admin"),
		middleware.TenantMiddleware(),
	)
	uploadlogo.NewEndpoint(logo)
	downloadlogo.NewEndpoint(logo)
	metalogo.NewEndpoint(logo)

	// Note: Public branding routes removed - login page uses static branding
}
