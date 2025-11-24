package list

import (
	"strconv"

	"github.com/gofiber/fiber/v3"

	"hrms/modules/salaryraise/internal/repository"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary List salary raise cycles
// @Description ดึงรอบปรับเงินเดือน
// @Tags Salary Raise
// @Produce json
// @Param page query int false "page"
// @Param limit query int false "limit"
// @Security BearerAuth
// @Success 200 {object} Response
// @Router /salary-raise-cycles [get]
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
