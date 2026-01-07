package itemslist

import (
	"strconv"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/salaryraise/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary List salary raise items
// @Tags Salary Raise
// @Produce json
// @Security BearerAuth
// @Param id path string true "cycle id"
// @Param search query string false "search employee name"
// @Success 200 {object} Response
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /salary-raise-cycles/{id}/items [get]
func NewEndpoint(router fiber.Router, repo repository.Repository) {
	router.Get("/:id/items", func(c fiber.Ctx) error {
		cycleID, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid cycle id")
		}
		search := c.Query("search")
		// accept departmentId param but ignore (not implemented)
		_ = c.Query("departmentId")

		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			CycleID: cycleID,
			Search:  search,
			Repo:    repo,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp)
	})
	// keep unused import warning away
	_ = strconv.Itoa
}
