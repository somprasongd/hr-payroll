package setbranches

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/userbranch/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// SetBranchesRequest represents the request body
type SetBranchesRequest struct {
	BranchIDs []string `json:"branchIds"`
}

// @Summary Set user's branch access
// @Tags UserBranch
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param userId path string true "user ID"
// @Param request body SetBranchesRequest true "branch IDs"
// @Success 200 {array} repository.BranchAccess
// @Router /admin/users/{userId}/branches [put]
func NewEndpoint(router fiber.Router, repo repository.Repository) {
	router.Put("/:userId/branches", func(c fiber.Ctx) error {
		actor, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		userID, err := uuid.Parse(c.Params("userId"))
		if err != nil {
			return errs.BadRequest("invalid userId")
		}

		var req SetBranchesRequest
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		var branchIDs []uuid.UUID
		for _, idStr := range req.BranchIDs {
			if id, err := uuid.Parse(idStr); err == nil {
				branchIDs = append(branchIDs, id)
			}
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			Repo:      repo,
			UserID:    userID,
			BranchIDs: branchIDs,
			ActorID:   actor.ID,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Branches)
	})
}
