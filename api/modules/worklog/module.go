package worklog

import (
	"hrms/modules/worklog/internal/feature/ft"
	"hrms/modules/worklog/internal/feature/pt"
	"hrms/modules/worklog/internal/repository"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/jwt"
	"hrms/shared/common/mediator"
	"hrms/shared/common/middleware"
	"hrms/shared/common/module"
	"hrms/shared/common/registry"

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

func (m *Module) Init(_ registry.ServiceRegistry, _ eventbus.EventBus) error {
	// FT
	mediator.Register[*ft.ListQuery, *ft.ListResponse](ft.NewListHandler())
	mediator.Register[*ft.GetQuery, *ft.GetResponse](ft.NewGetHandler())
	mediator.Register[*ft.CreateCommand, *ft.CreateResponse](ft.NewCreateHandler())
	mediator.Register[*ft.UpdateCommand, *ft.UpdateResponse](ft.NewUpdateHandler())
	mediator.Register[*ft.DeleteCommand, mediator.NoResponse](ft.NewDeleteHandler())

	// PT
	mediator.Register[*pt.ListQuery, *pt.ListResponse](pt.NewListHandler())
	mediator.Register[*pt.GetQuery, *pt.GetResponse](pt.NewGetHandler())
	mediator.Register[*pt.CreateCommand, *pt.CreateResponse](pt.NewCreateHandler())
	mediator.Register[*pt.UpdateCommand, *pt.UpdateResponse](pt.NewUpdateHandler())
	mediator.Register[*pt.DeleteCommand, mediator.NoResponse](pt.NewDeleteHandler())

	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	group := r.Group("/worklogs", middleware.Auth(m.tokenSvc))
	// FT
	ftGroup := group.Group("/ft")
	ft.Register(ftGroup, m.repo.FTRepo, m.ctx.Transactor)
	// PT
	ptGroup := group.Group("/pt")
	pt.Register(ptGroup, m.repo.PTRepo, m.ctx.Transactor)
}
