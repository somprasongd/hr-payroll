package employeecount

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/branch/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// EmployeeCountResponse represents the response for employee count
type EmployeeCountResponse struct {
	Count int `json:"count"`
}

// @Summary Get employee count for a branch
// @Tags Branches
// @Produce json
// @Security BearerAuth
// @Param id path string true "branch ID"
// @Success 200 {object} EmployeeCountResponse
// @Router /admin/branches/{id}/employee-count [get]
func NewEndpoint(router fiber.Router, repo repository.Repository) {
	router.Get("/:id/employee-count", func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			Repo: repo,
			ID:   id,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, EmployeeCountResponse{Count: resp.Count})
	})
}
