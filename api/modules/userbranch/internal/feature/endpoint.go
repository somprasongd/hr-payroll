package feature

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"go.uber.org/zap"
	"hrms/modules/userbranch/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/response"
)

// Register registers all user-branch endpoints
func Register(router fiber.Router, repo repository.Repository) {
	router.Get("/", listUsersHandler(repo))
	router.Get("/:userId/branches", getUserBranchesHandler(repo))
	router.Put("/:userId/branches", setUserBranchesHandler(repo))
}

// @Summary List company users
// @Tags UserBranch
// @Produce json
// @Security BearerAuth
// @Success 200 {array} repository.CompanyUser
// @Router /admin/users [get]
func listUsersHandler(repo repository.Repository) fiber.Handler {
	return func(c fiber.Ctx) error {
		users, err := repo.GetCompanyUsers(c.Context())
		if err != nil {
			logger.FromContext(c.Context()).Error("failed to list company users", zap.Error(err))
			return errs.Internal("failed to list users")
		}
		return response.JSON(c, fiber.StatusOK, users)
	}
}

// @Summary Get user's branch access
// @Tags UserBranch
// @Produce json
// @Security BearerAuth
// @Param userId path string true "user ID"
// @Success 200 {array} repository.BranchAccess
// @Router /admin/users/{userId}/branches [get]
func getUserBranchesHandler(repo repository.Repository) fiber.Handler {
	return func(c fiber.Ctx) error {
		userID, err := uuid.Parse(c.Params("userId"))
		if err != nil {
			return errs.BadRequest("invalid userId")
		}

		branches, err := repo.GetUserBranchAccess(c.Context(), userID)
		if err != nil {
			logger.FromContext(c.Context()).Error("failed to get user branches", zap.Error(err))
			return errs.Internal("failed to get user branches")
		}
		return response.JSON(c, fiber.StatusOK, branches)
	}
}

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
func setUserBranchesHandler(repo repository.Repository) fiber.Handler {
	return func(c fiber.Ctx) error {
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

		if err := repo.SetUserBranches(c.Context(), userID, branchIDs, actor.ID); err != nil {
			logger.FromContext(c.Context()).Error("failed to set user branches", zap.Error(err))
			return errs.Internal("failed to set user branches")
		}

		// Return updated branches
		branches, err := repo.GetUserBranchAccess(c.Context(), userID)
		if err != nil {
			logger.FromContext(c.Context()).Error("failed to get user branches after update", zap.Error(err))
			return errs.Internal("failed to get user branches")
		}
		return response.JSON(c, fiber.StatusOK, branches)
	}
}
