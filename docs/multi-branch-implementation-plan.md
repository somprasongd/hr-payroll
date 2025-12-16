# Multi-Branch Support Implementation Plan

## Summary

เพิ่มระบบรองรับหลายสาขาใน HR-Payroll โดย:

- **Admin**: ระดับบริษัท (เห็นทุกสาขา)
- **HR**: ระดับสาขา (สลับได้, ดูหลายสาขาพร้อมกันได้)
- **พนักงาน**: ผูกกับสาขาใดสาขาหนึ่ง

**Design Decisions:**

- ใช้ **Header** (`X-Company-ID`, `X-Branch-ID`) สำหรับ tenant selection
- ใช้ **ทั้ง RLS และ App Level Guard**
- HR สามารถ**ดูหลายสาขาพร้อมกันได้** (multi-branch filter)

---

## User Review Required

> [!IMPORTANT] > **Breaking Changes:**
>
> - ต้อง backfill `company_id`/`branch_id` ให้ข้อมูลเก่าทั้งหมด
> - Login flow จะเปลี่ยน (ต้องเลือกบริษัท/สาขา)
> - API ทุกตัวจะกรองตาม tenant

> [!WARNING] > **Migration Strategy:**
>
> - จะสร้าง company default และ branch default รายการแรก:
>   - Branch: `code = "00000"`, `name = "สำนักงานใหญ่"`
> - ข้อมูลเก่าทั้งหมดจะถูก assign ให้ default company/branch
> - หลัง migrate แล้ว ข้อมูลจะถูก isolate ตาม tenant

---

## Proposed Changes

### Database Component

#### [NEW] [migration_create_companies_branches.up.sql](file:///Users/somprasongd/Workspaces/outsrc/chaofavet/hr-payroll/migrations/20251216_create_companies_branches.up.sql)

```sql
-- Companies table
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id)
);

-- Branches table
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id),
  UNIQUE(company_id, code)
);

-- User role mappings
CREATE TABLE user_company_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'hr')),
  PRIMARY KEY (user_id, company_id)
);

CREATE TABLE user_branch_access (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, branch_id)
);
```

---

#### [NEW] [migration_add_tenant_columns.up.sql](file:///Users/somprasongd/Workspaces/outsrc/chaofavet/hr-payroll/migrations/20251217_add_tenant_columns.up.sql)

เพิ่ม `company_id`, `branch_id` ให้ตาราง:

| Table                | company_id | branch_id | Notes                    |
| -------------------- | ---------- | --------- | ------------------------ |
| `employees`          | ✅         | ✅        | พนักงานสังกัดสาขา        |
| `department`         | ✅         | ❌        | แผนกระดับบริษัท          |
| `employee_position`  | ✅         | ❌        | ตำแหน่งระดับบริษัท       |
| `payroll_config`     | ✅         | ❌        | Config ระดับบริษัท       |
| `payroll_run`        | ✅         | ✅        | รัน payroll ต่อสาขา      |
| `worklog_ft`         | ✅         | ✅        | ผ่าน employee            |
| `worklog_pt`         | ✅         | ✅        | ผ่าน employee            |
| `salary_advance`     | ✅         | ✅        | ผ่าน employee            |
| `debt_txn`           | ✅         | ✅        | ผ่าน employee            |
| `bonus_cycle`        | ✅         | ✅        | โบนัสต่อสาขา             |
| `salary_raise_cycle` | ✅         | ❌        | ปรับเงินเดือนระดับบริษัท |
| `org_profile`        | ✅         | ❌        | โปรไฟล์บริษัท            |

---

#### [NEW] [migration_enable_rls.up.sql](file:///Users/somprasongd/Workspaces/outsrc/chaofavet/hr-payroll/migrations/20251218_enable_rls.up.sql)

```sql
-- Enable RLS on main tables
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see employees in their company/branches
CREATE POLICY tenant_isolation ON employees
  USING (
    company_id = current_setting('app.current_company_id')::uuid
    AND (
      current_setting('app.is_admin', true)::boolean = true
      OR branch_id = ANY(string_to_array(current_setting('app.allowed_branches', true), ',')::uuid[])
    )
  );

-- Repeat for other tables...
```

---

### API Component

#### [NEW] [tenant.go](file:///Users/somprasongd/Workspaces/outsrc/chaofavet/hr-payroll/api/shared/common/contextx/tenant.go)

สร้างคู่กับ `user.go` ที่มีอยู่:

```go
package contextx

import "context"

type tenantKey struct{}

type TenantInfo struct {
    CompanyID string
    BranchIDs []string // multiple branches for multi-branch mode
    IsAdmin   bool
}

func TenantToContext(ctx context.Context, tenant TenantInfo) context.Context {
    return context.WithValue(ctx, tenantKey{}, tenant)
}

func TenantFromContext(ctx context.Context) (TenantInfo, bool) {
    tenant, ok := ctx.Value(tenantKey{}).(TenantInfo)
    return tenant, ok
}
```

---

#### [NEW] [tenant_middleware.go](file:///Users/somprasongd/Workspaces/outsrc/chaofavet/hr-payroll/api/app/application/middleware/tenant_middleware.go)

```go
package middleware

import (
    "hrms/shared/common/contextx"
)

// TenantMiddleware reads X-Company-ID, X-Branch-ID headers
// Validates user has access and sets tenant info in context
// NOTE: RLS session variables (SET LOCAL) will be set in transactor.WithinTransaction()
func TenantMiddleware(repo TenantRepo) fiber.Handler {
    return func(c fiber.Ctx) error {
        // 1. Read headers
        companyID := c.Get("X-Company-ID")
        branchIDs := strings.Split(c.Get("X-Branch-ID"), ",") // comma-separated for multi-branch

        // 2. Validate user has access
        userID := contextx.UserFromContext(c.Context())
        if !repo.HasCompanyAccess(userID, companyID) {
            return fiber.ErrForbidden
        }

        // 3. Set tenant info in context and update fiber context
        ctx := contextx.TenantToContext(c.Context(), contextx.TenantInfo{
            CompanyID: companyID,
            BranchIDs: branchIDs,
            IsAdmin:   IsAdmin(userID),
        })
        c.SetContext(ctx) // *** สำคัญ: set context กลับไปใน fiber ***

        return c.Next()
    }
}
```

---

#### [MODIFY] [transactor.go](file:///Users/somprasongd/Workspaces/outsrc/chaofavet/hr-payroll/api/shared/common/storage/sqldb/transactor/transactor.go)

เพิ่ม RLS session variables หลังสร้าง transaction:

```diff
 func (t *sqlTransactor) WithinTransaction(ctx context.Context, txFunc func(...) error) error {
     tx, err := currentDB.BeginTxx(ctx, nil)
     if err != nil {
         return fmt.Errorf("failed to begin transaction: %w", err)
     }

+    // Set RLS session variables from context
+    if tenant := GetTenantFromContext(ctx); tenant != nil {
+        tx.ExecContext(ctx, "SET LOCAL app.current_company_id = $1", tenant.CompanyID)
+        tx.ExecContext(ctx, "SET LOCAL app.allowed_branches = $1", strings.Join(tenant.BranchIDs, ","))
+        tx.ExecContext(ctx, "SET LOCAL app.is_admin = $1", tenant.IsAdmin)
+    }

     // ... rest of function
 }
```

**เหตุผล:** `SET LOCAL` มีผลเฉพาะใน transaction scope → ต้อง SET หลังจากสร้าง transaction

---

#### [NEW] [auth_switch_handler.go](file:///Users/somprasongd/Workspaces/outsrc/chaofavet/hr-payroll/api/app/application/handler/auth_switch_handler.go)

```go
// POST /auth/switch
// Request: { "companyId": "uuid", "branchIds": ["uuid", ...] }
// Response: { "accessToken": "...", "companies": [...], "branches": [...] }
```

---

#### [MODIFY] [http.go](file:///Users/somprasongd/Workspaces/outsrc/chaofavet/hr-payroll/api/app/application/http.go)

เพิ่ม TenantMiddleware หลัง AuthMiddleware:

```diff
 app.Use(mw.RequestLogger())
 app.Use(cors.New(...))
 app.Use(recover.New())
+
+// Tenant middleware for protected routes
+api := app.Group("/api/v1", authMiddleware, middleware.TenantMiddleware(tenantRepo))
```

---

### Web Component

#### [MODIFY] Login Flow

```
┌─────────────────────────────────────┐
│  1. Enter username/password         │
│  2. API returns companies/branches  │
│  3. Show company/branch selector    │
│     (auto-select if only one)       │
│  4. Call /auth/switch               │
│  5. Store token + tenant context    │
└─────────────────────────────────────┘
```

---

#### [NEW] [branch-switcher.tsx](file:///Users/somprasongd/Workspaces/outsrc/chaofavet/hr-payroll/web/src/components/layout/branch-switcher.tsx)

Topbar component แสดง company/branch ปัจจุบัน พร้อม dropdown สลับ

---

#### [NEW] [tenant-context.tsx](file:///Users/somprasongd/Workspaces/outsrc/chaofavet/hr-payroll/web/src/store/tenant-context.tsx)

React Context เก็บ:

- `currentCompany`
- `currentBranches` (array for multi-branch)
- `availableCompanies`
- `availableBranches`
- `switchTenant()` function

---

#### [MODIFY] API Services

ทุก service ต้องส่ง headers:

```typescript
const headers = {
  "X-Company-ID": tenantContext.currentCompany.id,
  "X-Branch-ID": tenantContext.currentBranches.map((b) => b.id).join(","),
};
```

---

#### [NEW] Admin UI - Company/Branch Settings

**หน้า Company Settings** (`/admin/settings/company`):

- ดู/แก้ไขข้อมูลบริษัท (code, name, status)
- เฉพาะ admin ระดับบริษัทเข้าถึงได้

**หน้า Branch Management** (`/admin/branches`):

- รายการสาขาทั้งหมด
- เพิ่ม/แก้ไข/ลบสาขา
- กำหนด default branch
- ตั้งค่า status (active/suspended)

**หน้า User Branch Access** (`/admin/users/:id/branches`):

- กำหนดสิทธิ์การเข้าถึงสาขาให้ user แต่ละคน
- สำหรับ HR: เลือกสาขาที่มีสิทธิ์ดูแล

---

## Verification Plan

### Automated Tests

> [!NOTE]
> ยังไม่มี unit tests สำหรับ middleware ใน codebase ปัจจุบัน จะสร้างใหม่

**New Unit Tests:**

```bash
# สร้าง test file ใหม่
# api/app/application/middleware/tenant_middleware_test.go

go test ./application/middleware/... -v -run TestTenantMiddleware
```

Test cases:

1. ไม่มี header → 400 Bad Request
2. Header ถูกต้องแต่ไม่มีสิทธิ์ → 403 Forbidden
3. Header ถูกต้องและมีสิทธิ์ → Pass + context มี tenant

---

### Manual Verification

**Step 1: Database Migration**

```bash
make mgu
# ตรวจสอบว่าตาราง companies, branches ถูกสร้าง
# ตรวจสอบว่า column company_id, branch_id ถูกเพิ่ม
```

**Step 2: Login Flow**

1. เปิด browser ไปที่ `/login`
2. Login ด้วย admin user
3. ควรเห็น company/branch selector (ถ้ามีมากกว่า 1)
4. เลือก company/branch
5. ควร redirect ไป dashboard

**Step 3: Branch Switching**

1. Login สำเร็จแล้ว
2. Click ที่ branch switcher บน topbar
3. เลือก branch อื่น
4. ข้อมูลในหน้าปัจจุบันควร refresh ตาม branch ใหม่

**Step 4: Multi-branch Filter (HR)**

1. Login เป็น HR ที่มีสิทธิ์หลายสาขา
2. ไปหน้า Employees
3. ควรเห็น filter สำหรับเลือกหลายสาขา
4. เลือก 2-3 สาขา
5. ข้อมูลควรแสดงพนักงานจากทุกสาขาที่เลือก

---

## Implementation Phases

| Phase | Description                                        | Est. Time |
| ----- | -------------------------------------------------- | --------- |
| 1     | Database migrations (companies, branches, columns) | 1 day     |
| 2     | RLS policies + backfill                            | 1 day     |
| 3     | API tenant middleware + auth/switch                | 2 days    |
| 4     | Update all repositories                            | 2-3 days  |
| 5     | Web login flow + switcher                          | 2 days    |
| 6     | Admin UI (Company/Branch settings)                 | 2 days    |
| 7     | Multi-branch filter UI                             | 1 day     |
| 8     | Testing + bugfix                                   | 2 days    |

**Total estimated: 12-14 days**
