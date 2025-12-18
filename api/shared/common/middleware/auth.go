package middleware

import (
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/jwt"
)

func Auth(tokenSvc *jwt.TokenService) fiber.Handler {
	return func(c fiber.Ctx) error {
		header := c.Get("Authorization")
		if header == "" {
			fmt.Printf("[Auth Middleware] Missing authorization header, path: %s\n", c.Path())
			return errs.Unauthorized("missing authorization header")
		}
		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
			fmt.Printf("[Auth Middleware] Invalid authorization header format: %s\n", header[:min(30, len(header))])
			return errs.Unauthorized("invalid authorization header")
		}

		claims, err := tokenSvc.ParseAccessToken(parts[1])
		if err != nil {
			// Debug: log the token parse error
			tokenPrefix := parts[1]
			if len(tokenPrefix) > 20 {
				tokenPrefix = tokenPrefix[:20]
			}
			fmt.Printf("[Auth Middleware] Token parse error: %v, token prefix: %s\n", err, tokenPrefix)
			return errs.Unauthorized("invalid or expired token")
		}

		ctx := contextx.WithUser(c.Context(), contextx.UserInfo{
			ID:       claims.UserID,
			Username: claims.Username,
			Role:     claims.Role,
		})
		c.SetContext(ctx)

		return c.Next()
	}
}

func RequireRoles(roles ...string) fiber.Handler {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}

	return func(c fiber.Ctx) error {
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return errs.Unauthorized("missing user context")
		}
		if len(allowed) == 0 {
			return c.Next()
		}
		if _, ok := allowed[user.Role]; !ok {
			return errs.Forbidden("insufficient permission")
		}
		return c.Next()
	}
}

// ExcludeRoles blocks specific roles from accessing routes
// Used to prevent superadmin from accessing regular tenant APIs
func ExcludeRoles(roles ...string) fiber.Handler {
	excluded := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		excluded[r] = struct{}{}
	}

	return func(c fiber.Ctx) error {
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return c.Next() // Let other middleware handle unauthenticated
		}
		if _, isExcluded := excluded[user.Role]; isExcluded {
			return errs.Forbidden("this role cannot access this resource")
		}
		return c.Next()
	}
}

// SuperAdminRouteRestriction blocks superadmin from accessing non-superadmin API routes
// and blocks non-superadmin users from accessing superadmin routes
func SuperAdminRouteRestriction() fiber.Handler {
	return func(c fiber.Ctx) error {
		path := c.Path()

		// Skip for non-API routes (health, docs, etc.)
		if !strings.HasPrefix(path, "/api/") {
			return c.Next()
		}

		// Get user from context (may not exist if not authenticated yet)
		user, ok := contextx.UserFromContext(c.Context())
		if !ok {
			return c.Next() // Let auth middleware handle unauthenticated users
		}

		isSuperAdminRoute := strings.Contains(path, "/super-admin")
		// /me routes are allowed for all authenticated users including superadmin
		isMeRoute := strings.Contains(path, "/me")

		// Superadmin can only access /super-admin/* routes or /me* routes
		if user.Role == "superadmin" && !isSuperAdminRoute && !isMeRoute {
			return errs.Forbidden("superadmin can only access super-admin routes")
		}

		// Non-superadmin cannot access /super-admin/* routes (double check, middleware should already block this)
		if user.Role != "superadmin" && isSuperAdminRoute {
			return errs.Forbidden("insufficient permission to access super-admin routes")
		}

		return c.Next()
	}
}
