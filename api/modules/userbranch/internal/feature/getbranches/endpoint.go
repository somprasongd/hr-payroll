package getbranches

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/userbranch/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/response"
)

// @Summary Get user's branch access
// @Tags UserBranch
// @Produce json
// @Security BearerAuth
// @Param userId path string true "user ID"
// @Success 200 {array} repository.BranchAccess
// @Param X-Company-ID header string false "Company ID"
// @Param X-Branch-ID header string false "Branch ID"

// @Router /admin/users/{userId}/branches [get]
func NewEndpoint(router fiber.Router, repo repository.Repository) {
	router.Get("/:userId/branches", func(c fiber.Ctx) error {
		userID, err := uuid.Parse(c.Params("userId"))
		if err != nil {
			return errs.BadRequest("invalid userId")
		}

		resp, err := mediator.Send[*Query, *Response](c.Context(), &Query{
			Repo:   repo,
			UserID: userID,
		})
		if err != nil {
			return err
		}
		return response.JSON(c, fiber.StatusOK, fiber.Map{"data": resp.Branches})
	})
}
