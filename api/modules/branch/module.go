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
	mediator.Register[*list.Query, *list.Response](list.NewHandler())
	mediator.Register[*get.Query, *get.Response](get.NewHandler())
	mediator.Register[*create.Command, *create.Response](create.NewHandler())
	mediator.Register[*update.Command, *update.Response](update.NewHandler())
	mediator.Register[*delete.Command, mediator.NoResponse](delete.NewHandler())
	mediator.Register[*setdefault.Command, mediator.NoResponse](setdefault.NewHandler())
	mediator.Register[*changestatus.Command, *changestatus.Response](changestatus.NewHandler())
	mediator.Register[*employeecount.Query, *employeecount.Response](employeecount.NewHandler())

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
	list.NewEndpoint(admin, m.repo)
	create.NewEndpoint(admin, m.repo, m.eb)
	get.NewEndpoint(admin, m.repo)
	update.NewEndpoint(admin, m.repo, m.eb)
	delete.NewEndpoint(admin, m.repo, m.eb)
	setdefault.NewEndpoint(admin, m.repo, m.eb)
	changestatus.NewEndpoint(admin, m.repo, m.eb)
	employeecount.NewEndpoint(admin, m.repo)
}

// GetRepository returns the repository for use by tenant middleware
func (m *Module) GetRepository() repository.Repository {
	return m.repo
}
