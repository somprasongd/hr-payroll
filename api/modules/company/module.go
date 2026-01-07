package company

import (
	"hrms/modules/company/internal/feature/createcompany"
	"hrms/modules/company/internal/feature/createdefaultbranch"
	"hrms/modules/company/internal/feature/get"
	"hrms/modules/company/internal/feature/getbyid"
	"hrms/modules/company/internal/feature/listall"
	"hrms/modules/company/internal/feature/update"
	"hrms/modules/company/internal/feature/updatebyid"
	"hrms/modules/company/internal/repository"
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

func (m *Module) Init(eb eventbus.EventBus) error {
	// Register internal handlers for company module endpoints
	mediator.Register[*get.Query, *get.Response](get.NewHandler(m.repo))
	mediator.Register[*update.Command, *update.Response](update.NewHandler(m.repo))

	// Register contract handlers for superadmin module to use via mediator
	mediator.Register[*contracts.ListAllCompaniesQuery, *contracts.ListAllCompaniesResponse](listall.NewHandler(m.repo))
	mediator.Register[*contracts.GetCompanyByIDQuery, *contracts.GetCompanyByIDResponse](getbyid.NewHandler(m.repo))
	mediator.Register[*contracts.CreateCompanyCommand, *contracts.CreateCompanyResponse](
		createcompany.NewHandler(m.repo, m.ctx.Transactor),
	)
	mediator.Register[*contracts.UpdateCompanyByIDCommand, *contracts.UpdateCompanyByIDResponse](
		updatebyid.NewHandler(m.repo, m.ctx.Transactor, eb),
	)
	mediator.Register[*contracts.CreateDefaultBranchCommand, *contracts.CreateDefaultBranchResponse](createdefaultbranch.NewHandler(m.repo))

	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	admin := r.Group("/admin/company", middleware.Auth(m.tokenSvc), middleware.TenantMiddleware(), middleware.RequireRoles("admin"))

	// Register CQRS endpoints
	get.NewEndpoint(admin)
	update.NewEndpoint(admin)
}
