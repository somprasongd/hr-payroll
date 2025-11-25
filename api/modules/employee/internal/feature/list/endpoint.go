package list

import (
	"strconv"

	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// List employees
// @Summary List employees
// @Description ค้นหาและดึงรายชื่อพนักงาน (Admin, Staff)
// @Tags Employees
// @Produce json
// @Param page query int false "page"
// @Param limit query int false "limit"
// @Param search query string false "ค้นหาจากชื่อ/รหัส"
// @Param status query string false "active|terminated|all"
// @Param employeeTypeId query string false "รหัสประเภทพนักงาน"
// @Security BearerAuth
// @Success 200 {object} Response
// @Failure 401
// @Failure 403
// @Router /employees [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/", func(c fiber.Ctx) error {
		page, _ := strconv.Atoi(c.Query("page", "1"))
		limit, _ := strconv.Atoi(c.Query("limit", "20"))
		search := c.Query("search")
		status := c.Query("status", "active")
		employeeTypeID := c.Query("employeeTypeId")

		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			Page:           page,
			Limit:          limit,
			Search:         search,
			Status:         status,
			EmployeeTypeID: employeeTypeID,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
