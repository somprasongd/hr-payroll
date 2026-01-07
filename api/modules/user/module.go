package user

import (
	"hrms/modules/user/internal/feature/assigntobranch"
	"hrms/modules/user/internal/feature/assigntocompany"
	"hrms/modules/user/internal/feature/changepassword"
	"hrms/modules/user/internal/feature/create"
	"hrms/modules/user/internal/feature/createwithpassword"
	"hrms/modules/user/internal/feature/delete"
	"hrms/modules/user/internal/feature/get"
	"hrms/modules/user/internal/feature/list"
	"hrms/modules/user/internal/feature/me"
	"hrms/modules/user/internal/feature/mecompanies"
	"hrms/modules/user/internal/feature/resetpassword"
	"hrms/modules/user/internal/feature/updaterole"
	"hrms/modules/user/internal/repository"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/jwt"
	"hrms/shared/common/mediator"
	"hrms/shared/common/middleware"
	"hrms/shared/common/module"
	"hrms/shared/contracts"

	"github.com/gofiber/fiber/v3"
)

type Module struct {
	ctx      *module.ModuleContext
	tokenSvc *jwt.TokenService
	repo     repository.Repository
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

func (m *Module) Init(eventBus eventbus.EventBus) error {
	// Internal user management handlers
	mediator.Register[*list.Query, *list.Response](list.NewHandler(m.repo))
	mediator.Register[*create.Command, *create.Response](create.NewHandler(m.repo, m.ctx.Transactor, eventBus))
	mediator.Register[*get.Query, *get.Response](get.NewHandler(m.repo))
	mediator.Register[*updaterole.Command, *updaterole.Response](updaterole.NewHandler(m.repo, eventBus))
	mediator.Register[*resetpassword.Command, *resetpassword.Response](resetpassword.NewHandler(m.repo, eventBus))
	mediator.Register[*delete.Command, mediator.NoResponse](delete.NewHandler(m.repo, eventBus))
	mediator.Register[*me.Query, *me.Response](me.NewHandler(m.repo))
	mediator.Register[*mecompanies.Query, *mecompanies.Response](mecompanies.NewHandler(m.repo))
	mediator.Register[*changepassword.Command, *changepassword.Response](changepassword.NewHandler(m.repo))

	// Contract handlers for superadmin module
	mediator.Register[*contracts.CreateUserWithPasswordCommand, *contracts.CreateUserWithPasswordResponse](createwithpassword.NewHandler(m.repo))
	mediator.Register[*contracts.AssignUserToCompanyCommand, *contracts.AssignUserToCompanyResponse](assigntocompany.NewHandler(m.repo))
	mediator.Register[*contracts.AssignUserToBranchCommand, *contracts.AssignUserToBranchResponse](assigntobranch.NewHandler(m.repo))

	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	// Admin user management routes - with tenant context for company filtering
	adminUsers := r.Group("/admin/users", middleware.Auth(m.tokenSvc), middleware.TenantMiddleware(), middleware.RequireRoles("admin"))
	list.NewEndpoint(adminUsers)
	create.NewEndpoint(adminUsers)
	get.NewEndpoint(adminUsers)
	updaterole.NewEndpoint(adminUsers)
	resetpassword.NewEndpoint(adminUsers)
	delete.NewEndpoint(adminUsers)

	// User self-service routes
	meGroup := r.Group("/me", middleware.Auth(m.tokenSvc))
	me.NewEndpoint(meGroup)
	changepassword.NewEndpoint(meGroup)
	mecompanies.NewEndpoint(meGroup)
}
