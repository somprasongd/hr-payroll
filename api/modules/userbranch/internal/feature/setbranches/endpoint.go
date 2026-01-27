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

// BranchAccess represents the branch access response for documentation
type BranchAccess = repository.BranchAccess

type RequestBody struct {
	BranchIDs []uuid.UUID `json:"branchIds"`
}

// @Summary Set user branches
// @Tags User-Branch Access
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param userId path string true "user ID"
// @Param request body RequestBody true "branches"
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"
// @Success 200 {array} BranchAccess
// @Router /admin/users/{userId}/branches [put]
func NewEndpoint(router fiber.Router) {
	router.Put("/:userId/branches", func(c fiber.Ctx) error {
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user context")
		}

		userID, err := uuid.Parse(c.Params("userId"))
		if err != nil {
			return errs.BadRequest("invalid user id")
		}

		var req RequestBody
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		resp, err := mediator.Send[*Command, *Response](c.Context(), &Command{
			UserID:    userID,
			BranchIDs: req.BranchIDs,
			ActorID:   user.ID,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, resp.Branches)
	})
}
