package application

import (
	"fmt"

	"hrms/config"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/module"
	"hrms/shared/common/registry"
)

type Application struct {
	config          config.Config
	httpServer      HTTPServer
	serviceRegistry registry.ServiceRegistry
	eventBus        eventbus.EventBus
}

func New(cfg config.Config, healthCheck HealthCheck) *Application {
	return &Application{
		config:          cfg,
		httpServer:      newHTTPServer(cfg, healthCheck),
		serviceRegistry: registry.NewServiceRegistry(),
		eventBus:        eventbus.NewInMemory(),
	}
}

func (app *Application) Run() {
	app.httpServer.Start()
}

func (app *Application) Shutdown() error {
	logger.Log().Info("shutting down server")
	return app.httpServer.Shutdown()
}

func (app *Application) RegisterModules(modules ...module.Module) error {
	for _, m := range modules {
		if err := app.initModule(m); err != nil {
			return fmt.Errorf("failed to init module [%T]: %w", m, err)
		}
		if sp, ok := m.(module.ServiceProvider); ok {
			for _, p := range sp.Services() {
				app.serviceRegistry.Register(p.Key, p.Value)
			}
		}
		app.registerModuleRoutes(m)
	}
	return nil
}

func (app *Application) initModule(m module.Module) error {
	return m.Init(app.serviceRegistry, app.eventBus)
}

func (app *Application) registerModuleRoutes(m module.Module) {
	prefix := app.buildGroupPrefix(m)
	group := app.httpServer.Group(prefix)
	m.RegisterRoutes(group)
}

func (app *Application) buildGroupPrefix(m module.Module) string {
	base := "/api"
	if v := m.APIVersion(); v != "" {
		return fmt.Sprintf("%s/%s", base, v)
	}
	return base
}
