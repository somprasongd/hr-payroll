# Multi-Branch Support Implementation Plan

## Summary

เพิ่มระบบรองรับหลายสาขาใน HR-Payroll โดย:

- **Admin**: ระดับบริษัท (เห็นทุกสาขา)
- **HR**: ระดับสาขา (สลับได้, ดูหลายสาขาพร้อมกันได้)
- **พนักงาน**: ผูกกับสาขาใดสาขาหนึ่ง

**Design Decisions:**

- ใช้ **Header** (`X-Company-ID`, `X-Branch-ID`) สำหรับ tenant selection
- ใช้ **ทั้ง RLS และ App Level Guard**
- HR สามารถ **ดูหลายสาขาพร้อมกันได้** (multi-branch filter)

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

---

## Proposed Changes

---

## 1. Database Changes

### 1.1 New Tables (4 ตาราง)

#### [NEW] `companies`

```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id)
);
```

#### [NEW] `branches`

```sql
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','archived')),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id),
  UNIQUE(company_id, code)
);
```

#### [NEW] `user_company_roles`

```sql
CREATE TABLE user_company_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'hr')),
  PRIMARY KEY (user_id, company_id)
);
```

#### [NEW] `user_branch_access`

```sql
CREATE TABLE user_branch_access (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, branch_id)
);
```

---

### 1.2 Tables Requiring Tenant Columns (17 ตาราง)

| Table                  | company_id | branch_id | Level   | Notes                    |
| ---------------------- | ---------- | --------- | ------- | ------------------------ |
| `users`                | ✅         | ❌        | Company | พนักงานระดับบริษัท       |
| `employees`            | ✅         | ✅        | Branch  | พนักงานสังกัดสาขา        |
| `employee_photo`       | ✅         | ❌        | Company | ผ่าน employee            |
| `employee_document`    | ✅         | ❌        | Company | ผ่าน employee            |
| `department`           | ✅         | ❌        | Company | แผนกระดับบริษัท          |
| `employee_position`    | ✅         | ❌        | Company | ตำแหน่งระดับบริษัท       |
| `payroll_config`       | ✅         | ❌        | Company | Config ระดับบริษัท       |
| `payroll_run`          | ✅         | ✅        | Branch  | รัน payroll ต่อสาขา      |
| `payroll_run_item`     | ✅         | ✅        | Branch  | ผ่าน payroll_run         |
| `payroll_accumulation` | ✅         | ❌        | Company | ผ่าน employee            |
| `worklog_ft`           | ✅         | ✅        | Branch  | ผ่าน employee            |
| `worklog_pt`           | ✅         | ✅        | Branch  | ผ่าน employee            |
| `payout_pt`            | ✅         | ✅        | Branch  | จ่าย PT ต่อสาขา          |
| `salary_advance`       | ✅         | ✅        | Branch  | เบิกล่วงหน้า             |
| `debt_txn`             | ✅         | ✅        | Branch  | หนี้สิน                  |
| `bonus_cycle`          | ✅         | ✅        | Branch  | โบนัสต่อสาขา             |
| `salary_raise_cycle`   | ✅         | ❌        | Company | ปรับเงินเดือนระดับบริษัท |
| `org_profile`          | ✅         | ❌        | Company | โปรไฟล์บริษัท            |
| `activity_log`         | ✅         | ✅        | Branch  | Log ตาม context          |

---

### 1.3 RLS Policies

```sql
-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_run ENABLE ROW LEVEL SECURITY;
-- ... repeat for all tables

-- Policy: tenant isolation
CREATE POLICY tenant_isolation ON employees USING (
  company_id = current_setting('app.current_company_id')::uuid
  AND (
    current_setting('app.is_admin', true)::boolean = true
    OR branch_id = ANY(string_to_array(current_setting('app.allowed_branches', true), ',')::uuid[])
  )
);
```

---

## 2. API Changes

### 2.1 New Modules (3 modules)

#### [NEW] Module: `company`

| Method | Endpoint                          | Description            |
| ------ | --------------------------------- | ---------------------- |
| GET    | `/api/v1/admin/companies/current` | ดูข้อมูลบริษัทปัจจุบัน |
| PUT    | `/api/v1/admin/companies/current` | แก้ไขข้อมูลบริษัท      |

#### [NEW] Module: `branch`

| Method | Endpoint                             | Description          |
| ------ | ------------------------------------ | -------------------- |
| GET    | `/api/v1/admin/branches`             | รายการสาขาทั้งหมด    |
| POST   | `/api/v1/admin/branches`             | สร้างสาขาใหม่        |
| GET    | `/api/v1/admin/branches/:id`         | ดูรายละเอียดสาขา     |
| PUT    | `/api/v1/admin/branches/:id`         | แก้ไขสาขา            |
| DELETE | `/api/v1/admin/branches/:id`         | ลบสาขา (soft delete) |
| PUT    | `/api/v1/admin/branches/:id/default` | กำหนด default branch |

#### [NEW] Module: `user-branch-access`

| Method | Endpoint                               | Description           |
| ------ | -------------------------------------- | --------------------- |
| GET    | `/api/v1/admin/users/:userId/branches` | สาขาที่ user มีสิทธิ์ |
| PUT    | `/api/v1/admin/users/:userId/branches` | กำหนดสิทธิ์สาขา       |

---

### 2.2 Modified Auth Module

| Method | Endpoint        | Description                                  |
| ------ | --------------- | -------------------------------------------- |
| POST   | `/auth/login`   | **เพิ่ม** response: `companies`, `branches`  |
| POST   | `/auth/switch`  | **ใหม่** สลับ company/branch, คืน token ใหม่ |
| POST   | `/auth/refresh` | **แก้ไข** ตรวจสอบ tenant access              |

**Login Response (เพิ่ม):**

```json
{
  "accessToken": "...",
  "user": {...},
  "companies": [{ "id": "...", "code": "...", "name": "..." }],
  "branches": [{ "id": "...", "companyId": "...", "code": "...", "name": "..." }]
}
```

**Switch Request:**

```json
{
  "companyId": "uuid",
  "branchIds": ["uuid", "uuid"]
}
```

---

### 2.3 New Shared Components

#### [NEW] `contextx/tenant.go`

```go
type TenantInfo struct {
    CompanyID string
    BranchIDs []string
    IsAdmin   bool
}
func TenantToContext(ctx, tenant) context.Context
func TenantFromContext(ctx) (TenantInfo, bool)
```

#### [NEW] `middleware/tenant_middleware.go`

- อ่าน headers `X-Company-ID`, `X-Branch-ID`
- Validate user access
- Set tenant to context via `c.SetContext(ctx)`

#### [MODIFY] `transactor/transactor.go`

- เพิ่ม `SET LOCAL` หลัง `BeginTxx()` สำหรับ RLS

---

### 2.4 Modified Modules (15 modules)

ทุก module ต้องปรับ repository ให้:

- เพิ่ม WHERE `company_id = ?` และ `branch_id IN (?)`
- INSERT/UPDATE ต้อง set tenant columns

| Module              | Changes                                     |
| ------------------- | ------------------------------------------- |
| `employee`          | เพิ่ม branch filter, tenant columns         |
| `masterdata`        | department/position filter by company       |
| `payrollconfig`     | filter by company                           |
| `payrollrun`        | filter by branch, generate items per branch |
| `worklog`           | FT/PT filter by branch                      |
| `salaryadvance`     | filter by branch                            |
| `debt`              | filter by branch                            |
| `bonus`             | filter by branch                            |
| `salaryraise`       | filter by company                           |
| `payoutpt`          | filter by branch                            |
| `payrollorgprofile` | filter by company                           |
| `user`              | เพิ่ม branch access management              |
| `auth`              | เพิ่ม switch, return companies/branches     |
| `dashboard`         | aggregate by selected branches              |
| `activitylog`       | log with tenant context                     |

---

## 3. Web UI Changes

### 3.1 New Pages (5 หน้า)

| Path                         | Description             | Access |
| ---------------------------- | ----------------------- | ------ |
| `/admin/company`             | ข้อมูลบริษัท (ดู/แก้ไข) | Admin  |
| `/admin/branches`            | รายการสาขา (CRUD)       | Admin  |
| `/admin/branches/new`        | สร้างสาขาใหม่           | Admin  |
| `/admin/branches/[id]`       | แก้ไขสาขา               | Admin  |
| `/admin/users/[id]/branches` | กำหนดสิทธิ์สาขา         | Admin  |

---

### 3.2 New Components (4 components)

| Component              | Description                       |
| ---------------------- | --------------------------------- |
| `branch-switcher.tsx`  | Topbar dropdown สลับ branch       |
| `tenant-context.tsx`   | React Context สำหรับ tenant state |
| `company-selector.tsx` | Dialog เลือก company (login)      |
| `branch-filter.tsx`    | Multi-select filter สำหรับ branch |

---

### 3.3 New Services (3 services)

| Service                  | Endpoints          |
| ------------------------ | ------------------ |
| `company.service.ts`     | GET/PUT company    |
| `branch.service.ts`      | CRUD branches      |
| `user-branch.service.ts` | User branch access |

---

### 3.4 Modified Services (18 services)

ทุก service ต้องเพิ่ม headers:

```typescript
headers: {
  'X-Company-ID': tenantContext.currentCompany.id,
  'X-Branch-ID': tenantContext.currentBranches.map(b => b.id).join(',')
}
```

| Service                     | Changes                   |
| --------------------------- | ------------------------- |
| `auth.service.ts`           | เพิ่ม `switch()`          |
| `employee.service.ts`       | เพิ่ม branch filter param |
| `payroll.service.ts`        | เพิ่ม branch filter       |
| `ft-worklog.service.ts`     | เพิ่ม branch filter       |
| `pt-worklog.service.ts`     | เพิ่ม branch filter       |
| `salary-advance-service.ts` | เพิ่ม branch filter       |
| `debt.service.ts`           | เพิ่ม branch filter       |
| `bonus-service.ts`          | เพิ่ม branch filter       |
| `salary-raise.service.ts`   | company level             |
| `payout-pt.service.ts`      | เพิ่ม branch filter       |
| `dashboard.service.ts`      | aggregate by branches     |
| `user.service.ts`           | branch access management  |
| _(and 6 more...)_           | Add tenant headers        |

---

### 3.5 Modified Pages

| Page           | Changes                       |
| -------------- | ----------------------------- |
| `/login`       | เพิ่ม company/branch selector |
| `/dashboard`   | Branch switcher in topbar     |
| `/employees`   | Branch multi-filter           |
| `/payroll/*`   | Branch filter                 |
| `/worklogs/*`  | Branch filter                 |
| `/admin/users` | Link to branch access page    |

---

## 4. Verification Plan

### Automated Tests

```bash
go test ./application/middleware/... -v -run TestTenantMiddleware
```

### Manual Testing

1. **Migration**: `make mgu` - ตรวจสอบ tables
2. **Login**: เลือก company/branch
3. **Switching**: สลับ branch จาก topbar
4. **Data Isolation**: ดูเฉพาะข้อมูลสาขาที่เลือก
5. **Multi-branch**: HR เลือกหลายสาขาพร้อมกัน
6. **Admin UI**: CRUD branches

---

## 5. Implementation Phases

| Phase | Description                               | Est. Time |
| ----- | ----------------------------------------- | --------- |
| 1     | Database: new tables + tenant columns     | 1 day     |
| 2     | Database: RLS policies + backfill         | 1 day     |
| 3     | API: tenant middleware + contextx         | 1 day     |
| 4     | API: auth switch + company/branch modules | 2 days    |
| 5     | API: update all 15 repositories           | 3 days    |
| 6     | Web: tenant context + login flow          | 2 days    |
| 7     | Web: branch switcher + multi-filter       | 1 day     |
| 8     | Web: admin pages (company/branch)         | 2 days    |
| 9     | Web: update 18 services                   | 2 days    |
| 10    | Testing + bugfix                          | 2 days    |

**Total estimated: 17-19 days**

---

## 6. Summary Counts

| Category        | New | Modified |
| --------------- | --- | -------- |
| Database Tables | 4   | 17       |
| API Modules     | 3   | 15       |
| API Endpoints   | ~15 | ~50+     |
| Web Pages       | 5   | 6        |
| Web Components  | 4   | 0        |
| Web Services    | 3   | 18       |
