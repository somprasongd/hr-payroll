package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/contextx"
	"hrms/shared/common/mediator"
	"hrms/shared/contracts"
)

// TenantMiddleware reads X-Company-ID, X-Branch-ID headers,
// validates user access via mediator, and sets tenant info in context.
// RLS session variables are set in transactor.WithinTransaction()
func TenantMiddleware() fiber.Handler {
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

		// Check company access via mediator
		accessResp, err := mediator.Send[*contracts.HasCompanyAccessQuery, *contracts.HasCompanyAccessResponse](
			c.Context(),
			&contracts.HasCompanyAccessQuery{UserID: user.ID, CompanyID: companyID},
		)
		if err != nil || !accessResp.HasAccess {
			return fiber.NewError(fiber.StatusForbidden, "access denied to this company")
		}

		// Check if admin via mediator
		adminResp, err := mediator.Send[*contracts.IsAdminQuery, *contracts.IsAdminResponse](
			c.Context(),
			&contracts.IsAdminQuery{UserID: user.ID, CompanyID: companyID},
		)
		isAdmin := err == nil && adminResp.IsAdmin

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
			// Get user branches via mediator
			branchResp, err := mediator.Send[*contracts.GetUserBranchesQuery, *contracts.GetUserBranchesResponse](
				c.Context(),
				&contracts.GetUserBranchesQuery{UserID: user.ID, CompanyID: companyID},
			)
			if err != nil {
				return fiber.NewError(fiber.StatusInternalServerError, "failed to get user branches")
			}
			branchIDs = branchResp.BranchIDs
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
func OptionalTenantMiddleware() fiber.Handler {
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

		// Check company access via mediator
		accessResp, err := mediator.Send[*contracts.HasCompanyAccessQuery, *contracts.HasCompanyAccessResponse](
			c.Context(),
			&contracts.HasCompanyAccessQuery{UserID: user.ID, CompanyID: companyID},
		)
		if err != nil || !accessResp.HasAccess {
			return c.Next()
		}

		// Check if admin via mediator
		adminResp, err := mediator.Send[*contracts.IsAdminQuery, *contracts.IsAdminResponse](
			c.Context(),
			&contracts.IsAdminQuery{UserID: user.ID, CompanyID: companyID},
		)
		isAdmin := err == nil && adminResp.IsAdmin

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
			// Get user branches via mediator
			branchResp, err := mediator.Send[*contracts.GetUserBranchesQuery, *contracts.GetUserBranchesResponse](
				c.Context(),
				&contracts.GetUserBranchesQuery{UserID: user.ID, CompanyID: companyID},
			)
			if err == nil {
				branchIDs = branchResp.BranchIDs
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
