package branch

import (
	"hrms/modules/branch/internal/feature/changestatus"
	"hrms/modules/branch/internal/feature/create"
	"hrms/modules/branch/internal/feature/delete"
	"hrms/modules/branch/internal/feature/employeecount"
	"hrms/modules/branch/internal/feature/get"
	"hrms/modules/branch/internal/feature/list"
	"hrms/modules/branch/internal/feature/setdefault"
	"hrms/modules/branch/internal/feature/update"
	"hrms/modules/branch/internal/repository"
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

	// Register handlers with mediator
	mediator.Register[*list.Query, *list.Response](list.NewHandler(m.repo))
	mediator.Register[*get.Query, *get.Response](get.NewHandler(m.repo))
	mediator.Register[*create.Command, *create.Response](create.NewHandler(m.repo, m.eb))
	mediator.Register[*update.Command, *update.Response](update.NewHandler(m.repo, m.eb))
	mediator.Register[*delete.Command, mediator.NoResponse](delete.NewHandler(m.repo, m.eb))
	mediator.Register[*setdefault.Command, mediator.NoResponse](setdefault.NewHandler(m.repo, m.eb))
	mediator.Register[*changestatus.Command, *changestatus.Response](changestatus.NewHandler(m.repo, m.eb))
	mediator.Register[*employeecount.Query, *employeecount.Response](employeecount.NewHandler(m.repo))

	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	// Admin routes - requires auth and admin role
	admin := r.Group(
		"/admin/branches",
		cmw.Auth(m.tokenSvc),
		cmw.RequireRoles("admin"),
		cmw.TenantMiddleware(),
	)

	// Register CQRS endpoints
	list.NewEndpoint(admin)
	create.NewEndpoint(admin)
	get.NewEndpoint(admin)
	update.NewEndpoint(admin)
	delete.NewEndpoint(admin)
	setdefault.NewEndpoint(admin)
	changestatus.NewEndpoint(admin)
	employeecount.NewEndpoint(admin)
}

// GetRepository returns the repository for use by tenant middleware
func (m *Module) GetRepository() repository.Repository {
	return m.repo
}
