package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/contextx"
)

// TenantRepo defines the interface for tenant access validation
type TenantRepo interface {
	HasCompanyAccess(userID, companyID uuid.UUID) bool
	GetUserBranches(userID, companyID uuid.UUID) ([]uuid.UUID, error)
	IsAdmin(userID, companyID uuid.UUID) bool
}

// TenantMiddleware reads X-Company-ID, X-Branch-ID headers,
// validates user access, and sets tenant info in context.
// RLS session variables are set in transactor.WithinTransaction()
func TenantMiddleware(repo TenantRepo) fiber.Handler {
	return func(c fiber.Ctx) error {
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return fiber.NewError(fiber.StatusUnauthorized, "user not found in context")
		}

		companyIDStr := c.Get("X-Company-ID")
		if companyIDStr == "" {
			// For backward compatibility, skip tenant check if no header
			return c.Next()
		}

		companyID, err := uuid.Parse(companyIDStr)
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "invalid X-Company-ID header")
		}

		if !repo.HasCompanyAccess(user.ID, companyID) {
			return fiber.NewError(fiber.StatusForbidden, "access denied to this company")
		}

		isAdmin := repo.IsAdmin(user.ID, companyID)

		var branchIDs []uuid.UUID
		branchIDsStr := c.Get("X-Branch-ID")
		if branchIDsStr != "" {
			for _, idStr := range strings.Split(branchIDsStr, ",") {
				idStr = strings.TrimSpace(idStr)
				if idStr == "" {
					continue
				}
				branchID, err := uuid.Parse(idStr)
				if err != nil {
					return fiber.NewError(fiber.StatusBadRequest, "invalid X-Branch-ID header")
				}
				branchIDs = append(branchIDs, branchID)
			}
		}

		if len(branchIDs) == 0 && !isAdmin {
			userBranches, err := repo.GetUserBranches(user.ID, companyID)
			if err != nil {
				return fiber.NewError(fiber.StatusInternalServerError, "failed to get user branches")
			}
			branchIDs = userBranches
		}

		tenant := contextx.TenantInfo{
			CompanyID: companyID,
			BranchIDs: branchIDs,
			IsAdmin:   isAdmin,
		}

		ctx := contextx.TenantToContext(c.Context(), tenant)
		c.SetContext(ctx)

		return c.Next()
	}
}

// OptionalTenantMiddleware is like TenantMiddleware but doesn't require headers.
// Used for endpoints that can work with or without tenant context.
func OptionalTenantMiddleware(repo TenantRepo) fiber.Handler {
	return func(c fiber.Ctx) error {
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return c.Next()
		}

		companyIDStr := c.Get("X-Company-ID")
		if companyIDStr == "" {
			return c.Next()
		}

		companyID, err := uuid.Parse(companyIDStr)
		if err != nil {
			return c.Next()
		}

		if !repo.HasCompanyAccess(user.ID, companyID) {
			return c.Next()
		}

		isAdmin := repo.IsAdmin(user.ID, companyID)

		var branchIDs []uuid.UUID
		branchIDsStr := c.Get("X-Branch-ID")
		if branchIDsStr != "" {
			for _, idStr := range strings.Split(branchIDsStr, ",") {
				idStr = strings.TrimSpace(idStr)
				if idStr == "" {
					continue
				}
				if branchID, err := uuid.Parse(idStr); err == nil {
					branchIDs = append(branchIDs, branchID)
				}
			}
		}

		if len(branchIDs) == 0 && !isAdmin {
			if userBranches, err := repo.GetUserBranches(user.ID, companyID); err == nil {
				branchIDs = userBranches
			}
		}

		tenant := contextx.TenantInfo{
			CompanyID: companyID,
			BranchIDs: branchIDs,
			IsAdmin:   isAdmin,
		}

		ctx := contextx.TenantToContext(c.Context(), tenant)
		c.SetContext(ctx)

		return c.Next()
	}
}
