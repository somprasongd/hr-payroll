package superadmin

import (
	"hrms/modules/superadmin/internal/feature/company/create"
	"hrms/modules/superadmin/internal/feature/company/get"
	"hrms/modules/superadmin/internal/feature/company/list"
	"hrms/modules/superadmin/internal/feature/company/update"
	doctypecreate "hrms/modules/superadmin/internal/feature/doctype/create"
	doctypedelete "hrms/modules/superadmin/internal/feature/doctype/delete"
	doctypelist "hrms/modules/superadmin/internal/feature/doctype/list"
	doctypeupdate "hrms/modules/superadmin/internal/feature/doctype/update"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/jwt"
	"hrms/shared/common/mediator"
	"hrms/shared/common/middleware"
	"hrms/shared/common/module"
	"hrms/shared/common/storage/sqldb/transactor"

	"github.com/gofiber/fiber/v3"
)

// Module handles super admin functionality
type Module struct {
	ctx      *module.ModuleContext
	tokenSvc *jwt.TokenService
	tx       transactor.Transactor
	eb       eventbus.EventBus
}

// NewModule creates a new super admin module
func NewModule(ctx *module.ModuleContext, tokenSvc *jwt.TokenService, tx transactor.Transactor) *Module {
	return &Module{
		ctx:      ctx,
		tokenSvc: tokenSvc,
		tx:       tx,
	}
}

func (m *Module) APIVersion() string { return "v1" }

func (m *Module) Init(eb eventbus.EventBus) error {
	m.eb = eb

	// Register handlers with mediator
	mediator.Register[*create.Command, *create.Response](create.NewHandler(m.tx, eb))
	mediator.Register[*update.Command, *update.Response](update.NewHandler(m.tx, eb))

	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	// Super admin routes - requires auth and superadmin role
	superAdmin := r.Group("/super-admin", middleware.Auth(m.tokenSvc), middleware.RequireRoles("superadmin"))

	// Company management - CQRS endpoints (use contracts via mediator)
	list.NewEndpoint(superAdmin)
	get.NewEndpoint(superAdmin)
	create.NewEndpoint(superAdmin)
	update.NewEndpoint(superAdmin)

	// Document type management - CQRS endpoints (use contracts via mediator)
	doctypelist.NewEndpoint(superAdmin)
	doctypecreate.NewEndpoint(superAdmin)
	doctypeupdate.NewEndpoint(superAdmin)
	doctypedelete.NewEndpoint(superAdmin)
}
