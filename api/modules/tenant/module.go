package tenant

import (
	"hrms/modules/tenant/internal/feature/getbranches"
	"hrms/modules/tenant/internal/feature/hasaccess"
	"hrms/modules/tenant/internal/feature/isadmin"
	"hrms/modules/tenant/internal/repository"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/mediator"
	"hrms/shared/common/module"
	"hrms/shared/contracts"

	"github.com/gofiber/fiber/v3"
)

// Module provides tenant access validation queries
type Module struct {
	ctx  *module.ModuleContext
	repo repository.Repository
}

// NewModule creates a new tenant module
func NewModule(ctx *module.ModuleContext) *Module {
	return &Module{
		ctx:  ctx,
		repo: repository.NewRepository(ctx.DBCtx),
	}
}

func (m *Module) APIVersion() string { return "v1" }

func (m *Module) Init(_ eventbus.EventBus) error {
	// Register query handlers
	mediator.Register[*contracts.HasCompanyAccessQuery, *contracts.HasCompanyAccessResponse](hasaccess.NewHandler(m.repo))
	mediator.Register[*contracts.GetUserBranchesQuery, *contracts.GetUserBranchesResponse](getbranches.NewHandler(m.repo))
	mediator.Register[*contracts.IsAdminQuery, *contracts.IsAdminResponse](isadmin.NewHandler(m.repo))
	return nil
}

// RegisterRoutes - tenant module has no HTTP endpoints, only mediator handlers
func (m *Module) RegisterRoutes(_ fiber.Router) {}
