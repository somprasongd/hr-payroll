package employee

import (
	"hrms/modules/employee/doctype"
	accdelete "hrms/modules/employee/internal/feature/accum/delete"
	acclist "hrms/modules/employee/internal/feature/accum/list"
	accupsert "hrms/modules/employee/internal/feature/accum/upsert"
	"hrms/modules/employee/internal/feature/checkduplicate"
	"hrms/modules/employee/internal/feature/create"
	"hrms/modules/employee/internal/feature/delete"
	doctypecreate "hrms/modules/employee/internal/feature/doctype/create"
	doctypedelete "hrms/modules/employee/internal/feature/doctype/delete"
	doctypelist "hrms/modules/employee/internal/feature/doctype/list"
	doctypeupdate "hrms/modules/employee/internal/feature/doctype/update"
	docdelete "hrms/modules/employee/internal/feature/document/delete"
	docdownload "hrms/modules/employee/internal/feature/document/download"
	docexpiring "hrms/modules/employee/internal/feature/document/expiring"
	doclist "hrms/modules/employee/internal/feature/document/list"
	docupdate "hrms/modules/employee/internal/feature/document/update"
	docupload "hrms/modules/employee/internal/feature/document/upload"
	"hrms/modules/employee/internal/feature/get"
	"hrms/modules/employee/internal/feature/list"
	photodelete "hrms/modules/employee/internal/feature/photo/delete"
	photodownload "hrms/modules/employee/internal/feature/photo/download"
	photoupload "hrms/modules/employee/internal/feature/photo/upload"
	"hrms/modules/employee/internal/feature/update"
	"hrms/modules/employee/internal/repository"
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
}

func NewModule(ctx *module.ModuleContext, tokenSvc *jwt.TokenService) *Module {
	repo := repository.NewRepository(ctx.DBCtx)
	return &Module{
		ctx:      ctx,
		repo:     repo,
		tokenSvc: tokenSvc,
	}
}

func (m *Module) APIVersion() string { return "v1" }

func (m *Module) Init(eventBus eventbus.EventBus) error {
	mediator.Register[*list.Query, *list.Response](list.NewHandler(m.repo))
	mediator.Register[*get.Query, *get.Response](get.NewHandler(m.repo))
	mediator.Register[*checkduplicate.Query, *checkduplicate.Response](checkduplicate.NewHandler(m.repo))
	mediator.Register[*create.Command, *create.Response](create.NewHandler(m.repo, m.ctx.Transactor, eventBus))
	mediator.Register[*update.Command, *update.Response](update.NewHandler(m.repo, m.ctx.Transactor, eventBus))
	mediator.Register[*delete.Command, mediator.NoResponse](delete.NewHandler(m.repo, eventBus))
	mediator.Register[*acclist.Query, *acclist.Response](acclist.NewHandler(m.repo))
	mediator.Register[*accupsert.Command, *accupsert.Response](accupsert.NewHandler(m.repo, eventBus))
	mediator.Register[*accdelete.Command, mediator.NoResponse](accdelete.NewHandler(m.repo, eventBus))
	mediator.Register[*photoupload.Command, *photoupload.Response](photoupload.NewHandler(m.repo, eventBus))
	mediator.Register[*photodownload.Query, *photodownload.Response](photodownload.NewHandler(m.repo))
	mediator.Register[*photodelete.Command, mediator.NoResponse](photodelete.NewHandler(m.repo, m.ctx.Transactor, eventBus))

	// Document Type handlers (custom types - company admin)
	mediator.Register[*doctypelist.Query, *doctypelist.Response](doctypelist.NewHandler(m.repo))
	mediator.Register[*doctypecreate.Command, *doctypecreate.Response](doctypecreate.NewHandler(m.repo, eventBus))
	mediator.Register[*doctypeupdate.Command, *doctypeupdate.Response](doctypeupdate.NewHandler(m.repo, eventBus))
	mediator.Register[*doctypedelete.Command, mediator.NoResponse](doctypedelete.NewHandler(m.repo, eventBus))

	// System Document Type handlers (superadmin) - uses public doctype package
	doctype.RegisterSystemHandlers(m.repo, eventBus)

	// Document handlers
	mediator.Register[*doclist.Query, *doclist.Response](doclist.NewHandler(m.repo))
	mediator.Register[*docupload.Command, *docupload.Response](docupload.NewHandler(m.repo, eventBus))
	mediator.Register[*docdownload.Query, *docdownload.Response](docdownload.NewHandler(m.repo))
	mediator.Register[*docupdate.Command, *docupdate.Response](docupdate.NewHandler(m.repo, eventBus))
	mediator.Register[*docdelete.Command, mediator.NoResponse](docdelete.NewHandler(m.repo, eventBus))
	mediator.Register[*docexpiring.Query, *docexpiring.Response](docexpiring.NewHandler(m.repo))

	return nil
}

func (m *Module) RegisterRoutes(r fiber.Router) {
	group := r.Group("/employees", middleware.Auth(m.tokenSvc), middleware.TenantMiddleware())
	// Staff & Admin
	list.NewEndpoint(group)
	checkduplicate.NewEndpoint(group) // Must be before get.NewEndpoint to avoid /:id matching
	create.NewEndpoint(group)
	get.NewEndpoint(group)
	update.NewEndpoint(group)

	photos := group.Group("/photos")
	// Admin & HR
	adminOrHR := group.Group("", middleware.RequireRoles("admin", "hr"))
	delete.NewEndpoint(adminOrHR)
	acclist.NewEndpoint(adminOrHR)
	photodownload.NewEndpoint(photos)
	photoupload.NewEndpoint(photos.Group("", middleware.RequireRoles("admin", "hr")))
	photodelete.NewEndpoint(group.Group("/:id/photo", middleware.RequireRoles("admin", "hr")))

	// Employee Documents - under /:id/documents
	docs := group.Group("/:id/documents", middleware.RequireRoles("admin", "hr"))
	doclist.NewEndpoint(docs)
	docupload.NewEndpoint(docs)
	docdownload.NewEndpoint(docs)
	docupdate.NewEndpoint(docs)
	docdelete.NewEndpoint(docs)

	// Admin only (mutations)
	admin := group.Group("", middleware.RequireRoles("admin"))
	accupsert.NewEndpoint(admin)
	accdelete.NewEndpoint(admin)

	// Document Types - separate top-level route (with tenant context)
	docTypes := r.Group("/employee-document-types", middleware.Auth(m.tokenSvc), middleware.TenantMiddleware())
	doctypelist.NewEndpoint(docTypes)
	adminDocTypes := docTypes.Group("", middleware.RequireRoles("admin"))
	doctypecreate.NewEndpoint(adminDocTypes)
	doctypeupdate.NewEndpoint(adminDocTypes)
	doctypedelete.NewEndpoint(adminDocTypes)

	// Expiring documents - separate route for dashboard (with tenant context)
	docsAdmin := r.Group("/documents", middleware.Auth(m.tokenSvc), middleware.RequireRoles("admin", "hr"), middleware.TenantMiddleware())
	docexpiring.NewEndpoint(docsAdmin)
}
