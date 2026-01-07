package feature

import (
	"github.com/gofiber/fiber/v3"

	"hrms/modules/masterdata/internal/feature/department"
	"hrms/modules/masterdata/internal/feature/employeeposition"
	"hrms/modules/masterdata/internal/feature/list"
	"hrms/shared/common/middleware"
)

func Register(router fiber.Router) {
	// Query operations
	list.Register(router)

	// Admin operations
	admin := router.Group("", middleware.RequireRoles("admin"))

	deptGroup := admin.Group("/departments")
	department.NewCreateEndpoint(deptGroup)
	department.NewUpdateEndpoint(deptGroup)
	department.NewDeleteEndpoint(deptGroup)

	posGroup := admin.Group("/employee-positions")
	employeeposition.NewCreateEndpoint(posGroup)
	employeeposition.NewUpdateEndpoint(posGroup)
	employeeposition.NewDeleteEndpoint(posGroup)
}
