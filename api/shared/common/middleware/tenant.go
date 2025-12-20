package middleware

import (
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

		// Branch ID is required (single value)
		branchIDStr := c.Get("X-Branch-ID")
		if branchIDStr == "" {
			return fiber.NewError(fiber.StatusBadRequest, "X-Branch-ID header is required")
		}

		branchID, err := uuid.Parse(branchIDStr)
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "invalid X-Branch-ID header")
		}

		tenant := contextx.TenantInfo{
			CompanyID: companyID,
			BranchID:  branchID,
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

		// Branch ID is optional in OptionalTenantMiddleware
		var branchID uuid.UUID
		branchIDStr := c.Get("X-Branch-ID")
		if branchIDStr != "" {
			if parsed, err := uuid.Parse(branchIDStr); err == nil {
				branchID = parsed
			}
		}

		// If no branch specified, get user's first allowed branch
		if branchID == uuid.Nil {
			branchResp, err := mediator.Send[*contracts.GetUserBranchesQuery, *contracts.GetUserBranchesResponse](
				c.Context(),
				&contracts.GetUserBranchesQuery{UserID: user.ID, CompanyID: companyID},
			)
			if err == nil && len(branchResp.BranchIDs) > 0 {
				branchID = branchResp.BranchIDs[0]
			}
		}

		tenant := contextx.TenantInfo{
			CompanyID: companyID,
			BranchID:  branchID,
			IsAdmin:   isAdmin,
		}

		ctx := contextx.TenantToContext(c.Context(), tenant)
		c.SetContext(ctx)

		return c.Next()
	}
}
