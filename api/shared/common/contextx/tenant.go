package contextx

import (
	"context"

	"github.com/google/uuid"
)

// TenantInfo holds tenant context information for multi-branch support
type TenantInfo struct {
	CompanyID uuid.UUID   // Current company ID
	BranchIDs []uuid.UUID // Allowed branch IDs (supports multi-branch)
	IsAdmin   bool        // Whether user is admin (can access all branches)
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

// BranchIDsToStrings converts branch UUIDs to strings for SQL
func (t TenantInfo) BranchIDsToStrings() []string {
	result := make([]string, len(t.BranchIDs))
	for i, id := range t.BranchIDs {
		result[i] = id.String()
	}
	return result
}

// BranchIDsCSV returns comma-separated branch IDs for RLS
func (t TenantInfo) BranchIDsCSV() string {
	if len(t.BranchIDs) == 0 {
		return ""
	}
	result := ""
	for i, id := range t.BranchIDs {
		if i > 0 {
			result += ","
		}
		result += id.String()
	}
	return result
}

// HasBranchAccess checks if a specific branch is in the allowed list
func (t TenantInfo) HasBranchAccess(branchID uuid.UUID) bool {
	if t.IsAdmin {
		return true
	}
	for _, id := range t.BranchIDs {
		if id == branchID {
			return true
		}
	}
	return false
}
