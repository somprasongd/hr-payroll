package salaryadvance

import (
	"hrms/modules/salaryadvance/internal/feature/create"
	"hrms/modules/salaryadvance/internal/feature/delete"
	"hrms/modules/salaryadvance/internal/feature/get"
	"hrms/modules/salaryadvance/internal/feature/list"
	"hrms/modules/salaryadvance/internal/feature/update"
	"hrms/modules/salaryadvance/internal/repository"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/jwt"
	"hrms/shared/common/mediator"
	"hrms/shared/common/middleware"
	"hrms/shared/common/module"

	"github.com/gofiber/fiber/v3"
)

type Module struct {
	ctx        *module.ModuleContext
	repo       repository.Repository
	tokenSvc   *jwt.TokenService
	eb         eventbus.EventBus
}

func NewModule(ctx *module.ModuleContext, tokenSvc *jwt.TokenService) *Module {
	repo := repository.NewRepository(ctx.DBCtx)
	return &Module{
		ctx:        ctx,
		repo:       repo,
		tokenSvc:   tokenSvc,
	}
}

func (m *Module) APIVersion() string { return "v1" }

func (m *Module) Init(eb eventbus.EventBus) error {
	m.eb = eb
	mediator.Register[*list.Query, *list.Response](list.NewHandler(m.repo))
	mediator.Register[*get.Query, *get.Response](get.NewHandler(m.repo))
	mediator.Register[*create.Command, *create.Response](create.NewHandler(m.repo, m.ctx.Transactor, eb))
	mediator.Register[*update.Command, *update.Response](update.NewHandler(m.repo, m.ctx.Transactor, eb))
	mediator.Register[*delete.Command, mediator.NoResponse](delete.NewHandler(m.repo, eb))
	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	group := r.Group("/salary-advances", middleware.Auth(m.tokenSvc), middleware.TenantMiddleware())
	list.NewEndpoint(group)
	get.NewEndpoint(group)
	create.NewEndpoint(group)
	update.NewEndpoint(group)
	delete.NewEndpoint(group)
}
