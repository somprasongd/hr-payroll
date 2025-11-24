package middleware

import (
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
			return errs.Unauthorized("missing authorization header")
		}
		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
			return errs.Unauthorized("invalid authorization header")
		}

		claims, err := tokenSvc.ParseAccessToken(parts[1])
		if err != nil {
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
