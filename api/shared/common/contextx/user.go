package contextx

import (
	"context"

	"github.com/google/uuid"
)

type UserInfo struct {
	ID       uuid.UUID
	Username string
	Role     string
}

type userKey struct{}

func WithUser(ctx context.Context, info UserInfo) context.Context {
	return context.WithValue(ctx, userKey{}, info)
}

func UserFromContext(ctx context.Context) (UserInfo, bool) {
	if ctx == nil {
		return UserInfo{}, false
	}
	if v, ok := ctx.Value(userKey{}).(UserInfo); ok {
		return v, true
	}
	return UserInfo{}, false
}
