package itemslist

import (
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/payrollrun/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary List payroll items
// @Description รายการสลิปเงินเดือนใน run
// @Tags Payroll Run
// @Produce json
// @Param id path string true "run id"
// @Param page query int false "page"
// @Param limit query int false "limit"
// @Param search query string false "employee name"
// @Param employeeTypeCode query string false "employee type code"
// @Security BearerAuth
// @Success 200 {object} ListResponse
// @Failure 400
// @Failure 401
// @Failure 403
// @Failure 404
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Router /payroll-runs/{id}/items [get]
func NewEndpoint(runRouter fiber.Router, repo repository.Repository) {
	runRouter.Get("/:id/items", func(c fiber.Ctx) error {
		runID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid run id")
		}
		page, _ := strconv.Atoi(c.Query("page", "1"))
		limit, _ := strconv.Atoi(c.Query("limit", "20"))
		search := c.Query("search")
		empType := strings.TrimSpace(c.Query("employeeTypeCode"))

		resp, err := mediator.Send[*ListQuery, *ListResponse](c.Context(), &ListQuery{
			RunID:            runID,
			Page:             page,
			Limit:            limit,
			Search:           search,
			EmployeeTypeCode: empType,
			Repo:             repo,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
