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
	// FT
	mediator.Register[*ft.ListQuery, *ft.ListResponse](ft.NewListHandler(m.repo.FTRepo))
	mediator.Register[*ft.GetQuery, *ft.GetResponse](ft.NewGetHandler(m.repo.FTRepo))
	mediator.Register[*ft.CreateCommand, *ft.CreateResponse](ft.NewCreateHandler(m.repo.FTRepo, m.ctx.Transactor, eb))
	mediator.Register[*ft.UpdateCommand, *ft.UpdateResponse](ft.NewUpdateHandler(m.repo.FTRepo, m.ctx.Transactor, eb))
	mediator.Register[*ft.DeleteCommand, mediator.NoResponse](ft.NewDeleteHandler(m.repo.FTRepo, eb))

	// PT
	mediator.Register[*pt.ListQuery, *pt.ListResponse](pt.NewListHandler(m.repo.PTRepo))
	mediator.Register[*pt.GetQuery, *pt.GetResponse](pt.NewGetHandler(m.repo.PTRepo))
	mediator.Register[*pt.CreateCommand, *pt.CreateResponse](pt.NewCreateHandler(m.repo.PTRepo, m.ctx.Transactor, eb))
	mediator.Register[*pt.UpdateCommand, *pt.UpdateResponse](pt.NewUpdateHandler(m.repo.PTRepo, m.ctx.Transactor, eb))
	mediator.Register[*pt.DeleteCommand, mediator.NoResponse](pt.NewDeleteHandler(m.repo.PTRepo, eb))

	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	// Allow admin, hr, and timekeeper roles to access worklog endpoints
	group := r.Group("/worklogs", middleware.Auth(m.tokenSvc), middleware.TenantMiddleware(), middleware.RequireRoles("admin", "hr", "timekeeper"))
	// FT
	ftGroup := group.Group("/ft")
	ft.Register(ftGroup)
	// PT
	ptGroup := group.Group("/pt")
	pt.Register(ptGroup)
}
