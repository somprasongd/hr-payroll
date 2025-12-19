package changestatus

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/branch/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// StatusChangeRequest represents the request body for changing branch status
type StatusChangeRequest struct {
	Status string `json:"status" validate:"required,oneof=active suspended archived"`
}

// StatusChangeResponse includes branch and employee count for confirmation
type StatusChangeResponse struct {
	Branch        *repository.Branch `json:"branch"`
	EmployeeCount int                `json:"employeeCount"`
}

// @Summary Change branch status
// @Tags Branches
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "branch ID"
// @Param request body StatusChangeRequest true "status payload"
// @Success 200 {object} StatusChangeResponse
// @Router /admin/branches/{id}/status [patch]
func NewEndpoint(router fiber.Router, repo repository.Repository, eb eventbus.EventBus) {
	router.Patch("/:id/status", func(c fiber.Ctx) error {
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		var req StatusChangeRequest
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		// Validate status value
		if req.Status != "active" && req.Status != "suspended" && req.Status != "archived" {
			return errs.BadRequest("invalid status value")
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			Repo:      repo,
			Eb:        eb,
			ID:        id,
			NewStatus: req.Status,
			ActorID:   user.ID,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, StatusChangeResponse{
			Branch:        resp.Branch,
			EmployeeCount: resp.EmployeeCount,
		})
	})
}
