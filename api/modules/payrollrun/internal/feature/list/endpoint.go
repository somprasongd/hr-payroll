package list

import (
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"

	"hrms/modules/payrollrun/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary List payroll runs
// @Description ดึงประวัติงวดเงินเดือน
// @Tags Payroll Run
// @Produce json
// @Param page query int false "page"
// @Param limit query int false "limit"
// @Param status query string false "pending|approved|all"
// @Param year query int false "filter by year of payrollMonthDate"
// @Param monthDate query string false "YYYY-MM-DD (will use month & year from this date to filter payroll_month_date)"
// @Security BearerAuth
// @Success 200 {object} Response
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
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
		var month *time.Time
		if v := strings.TrimSpace(c.Query("monthDate")); v != "" {
			md, err := time.Parse("2006-01-02", v)
			if err != nil {
				return errs.BadRequest("monthDate must be YYYY-MM-DD")
			}
			start := time.Date(md.Year(), md.Month(), 1, 0, 0, 0, 0, time.UTC)
			month = &start
		}

		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			Page:   page,
			Limit:  limit,
			Status: status,
			Year:   year,
			Month:  month,
			Repo:   repo,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
