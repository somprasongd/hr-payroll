package module

import (
	"hrms/shared/common/eventbus"
	"hrms/shared/common/registry"
	"hrms/shared/common/storage/sqldb/transactor"

	"github.com/gofiber/fiber/v3"
)

type Module interface {
	APIVersion() string
	Init(reg registry.ServiceRegistry, eventBus eventbus.EventBus) error
	RegisterRoutes(r fiber.Router)
}

type ServiceProvider interface {
	Services() []registry.ProvidedService
}

type ModuleContext struct {
	Transactor transactor.Transactor
	DBCtx      transactor.DBTXContext
}

func NewModuleContext(transactor transactor.Transactor, dbCtx transactor.DBTXContext) *ModuleContext {
	return &ModuleContext{Transactor: transactor, DBCtx: dbCtx}
}
