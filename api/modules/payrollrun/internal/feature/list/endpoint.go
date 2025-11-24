package list

import (
	"strconv"

	"github.com/gofiber/fiber/v3"

	"hrms/modules/payrollrun/internal/repository"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary List payroll runs
// @Description ดึงประวัติงวดเงินเดือน
// @Tags Payroll Run
// @Produce json
// @Param page query int false "page"
// @Param limit query int false "limit"
// @Param status query string false "processing|pending|approved|all"
// @Param year query int false "filter by year of payrollMonthDate"
// @Security BearerAuth
// @Success 200 {object} Response
// @Router /payroll-runs [get]
func NewEndpoint(router fiber.Router, repo repository.Repository) {
	router.Get("/", func(c fiber.Ctx) error {
		page, _ := strconv.Atoi(c.Query("page", "1"))
		limit, _ := strconv.Atoi(c.Query("limit", "20"))
		status := c.Query("status", "all")
		var year *int
		if v := c.Query("year"); v != "" {
			if n, err := strconv.Atoi(v); err == nil {
				year = &n
			}
		}

		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			Page:   page,
			Limit:  limit,
			Status: status,
			Year:   year,
			Repo:   repo,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
