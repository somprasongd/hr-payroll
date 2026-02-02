package module

import (
	"hrms/shared/common/eventbus"
	"hrms/shared/common/storage/sqldb/transactor"

	"github.com/gofiber/fiber/v3"
)

type Module interface {
	APIVersion() string
	Init(eventBus eventbus.EventBus) error
	RegisterRoutes(r fiber.Router)
}

// SuperAdminRouteRegistrar is an optional interface for modules that need to register
// routes accessible only to superadmin users (e.g., system-level settings like system banks).
type SuperAdminRouteRegistrar interface {
	RegisterSuperAdminRoutes(r fiber.Router)
}

type ModuleContext struct {
	Transactor transactor.Transactor
	DBCtx      transactor.DBTXContext
}

func NewModuleContext(transactor transactor.Transactor, dbCtx transactor.DBTXContext) *ModuleContext {
	return &ModuleContext{Transactor: transactor, DBCtx: dbCtx}
}
