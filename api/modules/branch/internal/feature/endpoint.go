package feature

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/modules/branch/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/response"

	"go.uber.org/zap"
)

// Register registers all branch endpoints
func Register(router fiber.Router, repo repository.Repository) {
	router.Get("/", listHandler(repo))
	router.Post("/", createHandler(repo))
	router.Get("/:id", getHandler(repo))
	router.Patch("/:id", updateHandler(repo))
	router.Delete("/:id", deleteHandler(repo))
	router.Put("/:id/default", setDefaultHandler(repo))
	router.Patch("/:id/status", changeStatusHandler(repo))
	router.Get("/:id/employee-count", getEmployeeCountHandler(repo))
}

// @Summary List all branches
// @Tags Branches
// @Produce json
// @Security BearerAuth
// @Success 200 {array} repository.Branch
// @Router /admin/branches [get]
func listHandler(repo repository.Repository) fiber.Handler {
	return func(c fiber.Ctx) error {
		branches, err := repo.List(c.Context())
		if err != nil {
			logger.FromContext(c.Context()).Error("failed to list branches", zap.Error(err))
			return errs.Internal("failed to list branches")
		}
		return response.JSON(c, fiber.StatusOK, branches)
	}
}

// CreateRequest represents the request body for creating a branch
type CreateRequest struct {
	Code string `json:"code" validate:"required,min=1,max=10"`
	Name string `json:"name" validate:"required,min=1,max=100"`
}

// @Summary Create a new branch
// @Tags Branches
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateRequest true "branch payload"
// @Success 201 {object} repository.Branch
// @Router /admin/branches [post]
func createHandler(repo repository.Repository) fiber.Handler {
	return func(c fiber.Ctx) error {
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		var req CreateRequest
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		if req.Code == "" || req.Name == "" {
			return errs.BadRequest("code and name are required")
		}

		branch, err := repo.Create(c.Context(), req.Code, req.Name, user.ID)
		if err != nil {
			logger.FromContext(c.Context()).Error("failed to create branch", zap.Error(err))
			return errs.Internal("failed to create branch")
		}
		return response.JSON(c, fiber.StatusCreated, branch)
	}
}

// @Summary Get a branch by ID
// @Tags Branches
// @Produce json
// @Security BearerAuth
// @Param id path string true "branch ID"
// @Success 200 {object} repository.Branch
// @Router /admin/branches/{id} [get]
func getHandler(repo repository.Repository) fiber.Handler {
	return func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		branch, err := repo.GetByID(c.Context(), id)
		if err != nil {
			logger.FromContext(c.Context()).Error("failed to get branch", zap.Error(err))
			return errs.NotFound("branch not found")
		}
		return response.JSON(c, fiber.StatusOK, branch)
	}
}

// UpdateRequest represents the request body for updating a branch
type UpdateRequest struct {
	Code   string `json:"code" validate:"required,min=1,max=10"`
	Name   string `json:"name" validate:"required,min=1,max=100"`
	Status string `json:"status" validate:"required,oneof=active suspended"`
}

// @Summary Update a branch
// @Tags Branches
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "branch ID"
// @Param request body UpdateRequest true "branch payload"
// @Success 200 {object} repository.Branch
// @Router /admin/branches/{id} [patch]
func updateHandler(repo repository.Repository) fiber.Handler {
	return func(c fiber.Ctx) error {
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		// Rule 2: Cannot edit suspended or archived branches
		existing, err := repo.GetByID(c.Context(), id)
		if err != nil {
			return errs.NotFound("branch not found")
		}
		if existing.Status == "suspended" || existing.Status == "archived" {
			return errs.BadRequest("cannot edit suspended or archived branch, use status change endpoint instead")
		}

		var req UpdateRequest
		if err := c.Bind().Body(&req); err != nil {
			return errs.BadRequest("invalid request body")
		}

		if req.Status == "" {
			req.Status = "active"
		}

		branch, err := repo.Update(c.Context(), id, req.Code, req.Name, req.Status, user.ID)
		if err != nil {
			logger.FromContext(c.Context()).Error("failed to update branch", zap.Error(err))
			return errs.NotFound("branch not found")
		}
		return response.JSON(c, fiber.StatusOK, branch)
	}
}

// @Summary Delete a branch (soft delete)
// @Description Soft deletes a branch. Branch must be archived before deletion.
// @Tags Branches
// @Security BearerAuth
// @Param id path string true "branch ID"
// @Success 204
// @Failure 400 {object} response.Problem "Branch must be archived before deletion"
// @Router /admin/branches/{id} [delete]
func deleteHandler(repo repository.Repository) fiber.Handler {
	return func(c fiber.Ctx) error {
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		// First check the branch status
		branch, err := repo.GetByID(c.Context(), id)
		if err != nil {
			return errs.NotFound("branch not found")
		}

		// Rule: Cannot delete default branch
		if branch.IsDefault {
			return errs.BadRequest("cannot delete default branch")
		}

		// Rule: Can only delete archived branches
		if branch.Status != "archived" {
			return errs.BadRequest("branch must be archived before deletion")
		}

		if err := repo.Delete(c.Context(), id, user.ID); err != nil {
			logger.FromContext(c.Context()).Error("failed to delete branch", zap.Error(err))
			return errs.BadRequest("cannot delete this branch")
		}
		return c.SendStatus(fiber.StatusNoContent)
	}
}

// @Summary Set a branch as default
// @Tags Branches
// @Security BearerAuth
// @Param id path string true "branch ID"
// @Success 204
// @Router /admin/branches/{id}/default [put]
func setDefaultHandler(repo repository.Repository) fiber.Handler {
	return func(c fiber.Ctx) error {
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user")
		}

		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		if err := repo.SetDefault(c.Context(), id, user.ID); err != nil {
			logger.FromContext(c.Context()).Error("failed to set default branch", zap.Error(err))
			return errs.NotFound("branch not found")
		}
		return c.SendStatus(fiber.StatusNoContent)
	}
}

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
func changeStatusHandler(repo repository.Repository) fiber.Handler {
	return func(c fiber.Ctx) error {
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

		// Get current branch
		branch, err := repo.GetByID(c.Context(), id)
		if err != nil {
			return errs.NotFound("branch not found")
		}

		// Rule 1: Cannot change status of default branch to non-active
		if branch.IsDefault && req.Status != "active" {
			return errs.BadRequest("cannot suspend or archive default branch")
		}

		// Rule 3: Validate status transitions
		currentStatus := branch.Status
		newStatus := req.Status

		// archived → suspended is not allowed
		if currentStatus == "archived" && newStatus == "suspended" {
			return errs.BadRequest("cannot change from archived to suspended")
		}

		// Get employee count (for warning when archiving)
		employeeCount := 0
		if newStatus == "archived" {
			count, err := repo.GetEmployeeCountByBranch(c.Context(), id)
			if err != nil {
				logger.FromContext(c.Context()).Error("failed to get employee count", zap.Error(err))
			} else {
				employeeCount = count
			}
		}

		// Update status
		updatedBranch, err := repo.UpdateStatus(c.Context(), id, newStatus, user.ID)
		if err != nil {
			logger.FromContext(c.Context()).Error("failed to update branch status", zap.Error(err))
			return errs.Internal("failed to update branch status")
		}

		return response.JSON(c, fiber.StatusOK, StatusChangeResponse{
			Branch:        updatedBranch,
			EmployeeCount: employeeCount,
		})
	}
}

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
func getEmployeeCountHandler(repo repository.Repository) fiber.Handler {
	return func(c fiber.Ctx) error {
		id, err := uuid.Parse(c.Params("id"))
		if err != nil {
			return errs.BadRequest("invalid id")
		}

		count, err := repo.GetEmployeeCountByBranch(c.Context(), id)
		if err != nil {
			logger.FromContext(c.Context()).Error("failed to get employee count", zap.Error(err))
			return errs.Internal("failed to get employee count")
		}

		return response.JSON(c, fiber.StatusOK, EmployeeCountResponse{Count: count})
	}
}
