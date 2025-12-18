package list

import (
	"strconv"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/contextx"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// List users
// @Summary List users
// @Description ดึงรายชื่อผู้ใช้งานทั้งหมด (Admin)
// @Tags Admin Users
// @Produce json
// @Param page query int false "page"
// @Param limit query int false "limit"
// @Param role query string false "role filter"
// @Security BearerAuth
// @Success 200 {object} Response
// @Failure 401
// @Failure 403
// @Router /admin/users [get]
func NewEndpoint(router fiber.Router) {
	router.Get("/", func(c fiber.Ctx) error {
		page, _ := strconv.Atoi(c.Query("page", "1"))
		limit, _ := strconv.Atoi(c.Query("limit", "20"))
		role := c.Query("role")

		// Get company ID from tenant context
		var companyID uuid.UUID
		if tenant, ok := contextx.TenantFromContext(c.Context()); ok {
			companyID = tenant.CompanyID
		}

		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			Page:      page,
			Limit:     limit,
			Role:      role,
			CompanyID: companyID,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
