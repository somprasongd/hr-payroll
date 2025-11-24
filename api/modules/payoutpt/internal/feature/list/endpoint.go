package list

import (
	"strconv"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/payoutpt/internal/repository"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary List part-time payouts
// @Tags Part-Time Payout
// @Produce json
// @Security BearerAuth
// @Param employeeId query string false "filter by employee"
// @Param status query string false "to_pay|paid|all"
// @Param page query int false "page"
// @Param limit query int false "limit"
// @Success 200 {object} Response
// @Router /payouts/pt [get]
func NewEndpoint(router fiber.Router, repo repository.Repository) {
	router.Get("/", func(c fiber.Ctx) error {
		page, _ := strconv.Atoi(c.Query("page", "1"))
		limit, _ := strconv.Atoi(c.Query("limit", "20"))
		status := c.Query("status", "all")
		var empID *uuid.UUID
		if v := c.Query("employeeId"); v != "" {
			if id, err := uuid.Parse(v); err == nil {
				empID = &id
			}
		}

		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			Page:       page,
			Limit:      limit,
			Status:     status,
			EmployeeID: empID,
			Repo:       repo,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
}
