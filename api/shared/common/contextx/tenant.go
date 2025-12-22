package contextx

import (
	"context"

	"github.com/google/uuid"
)

// TenantInfo holds tenant context information for multi-tenant support
type TenantInfo struct {
	CompanyID uuid.UUID // Current company ID
	BranchID  uuid.UUID // Selected branch ID (single branch per request)
	IsAdmin   bool      // Whether user is admin
}

type tenantKey struct{}

// TenantToContext adds tenant info to context
func TenantToContext(ctx context.Context, tenant TenantInfo) context.Context {
	return context.WithValue(ctx, tenantKey{}, tenant)
}

// TenantFromContext retrieves tenant info from context
func TenantFromContext(ctx context.Context) (TenantInfo, bool) {
	if ctx == nil {
		return TenantInfo{}, false
	}
	if v, ok := ctx.Value(tenantKey{}).(TenantInfo); ok {
		return v, true
	}
	return TenantInfo{}, false
}

// HasBranchID checks if a branch ID is set
func (t TenantInfo) HasBranchID() bool {
	return t.BranchID != uuid.Nil
}

// BranchIDPtr returns a pointer to BranchID if it's not Nil, otherwise nil
func (t TenantInfo) BranchIDPtr() *uuid.UUID {
	if t.BranchID == uuid.Nil {
		return nil
	}
	return &t.BranchID
}
