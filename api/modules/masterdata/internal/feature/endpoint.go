package feature

import (
	"github.com/gofiber/fiber/v3"

	"hrms/modules/masterdata/internal/feature/bank"
	"hrms/modules/masterdata/internal/feature/department"
	"hrms/modules/masterdata/internal/feature/employeeposition"
	"hrms/modules/masterdata/internal/feature/list"
	"hrms/shared/common/middleware"
)

func Register(router fiber.Router) {
	// Query operations
	list.Register(router)

	// Admin operations
	admin := router.Group("", middleware.RequireRoles("admin", "hr"))

	deptGroup := admin.Group("/departments")
	department.NewCreateEndpoint(deptGroup)
	department.NewUpdateEndpoint(deptGroup)
	department.NewDeleteEndpoint(deptGroup)

	posGroup := admin.Group("/employee-positions")
	employeeposition.NewCreateEndpoint(posGroup)
	employeeposition.NewUpdateEndpoint(posGroup)
	employeeposition.NewDeleteEndpoint(posGroup)

	// Bank routes for company admin
	bankGroup := admin.Group("/banks")
	bank.NewListEndpoint(bankGroup)
	bank.NewCreateEndpoint(bankGroup)
	bank.NewUpdateEndpoint(bankGroup)
	bank.NewDeleteEndpoint(bankGroup)
	bank.NewToggleEndpoint(bankGroup)
}

func RegisterSystemBanks(router fiber.Router) {
	// System banks for superadmin
	sysBankGroup := router.Group("/system-banks")
	bank.NewListSystemBanksEndpoint(sysBankGroup)
	bank.NewCreateSystemBankEndpoint(sysBankGroup)
	bank.NewUpdateSystemBankEndpoint(sysBankGroup)
	bank.NewDeleteSystemBankEndpoint(sysBankGroup)
	bank.NewToggleSystemBankEndpoint(sysBankGroup)
}
