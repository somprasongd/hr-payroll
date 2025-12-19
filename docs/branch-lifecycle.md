# Branch Lifecycle & Status Management

## Overview

เอกสารนี้อธิบาย lifecycle ของสาขา (Branch) และ flow การเปลี่ยนสถานะต่างๆ รวมถึงการ Soft Delete

---

## Branch Status Flow

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
                    ▼                                         │
              ┌──────────┐                                    │
   [Create] ──►  active  │◄──────────────────────────────────┐│
              └────┬─────┘                                   ││
                   │                                         ││
          ┌────────┴────────┐                                ││
          ▼                 ▼                                ││
     ┌──────────┐     ┌──────────┐                           ││
     │ suspended│     │ archived │──────► [Soft Delete]      ││
     └────┬─────┘     └────┬─────┘              │            ││
          │                │                    ▼            ││
          │                │            ┌────────────┐       ││
          │                │            │  deleted   │       ││
          │                │            │            │       ││
          └────────────────┴────────────┤(deleted_at │       ││
                   │                    │  IS NOT    │       ││
                   │                    │   NULL)    │       ││
                   │                    └────────────┘       ││
                   │                                         ││
                   └─────────────────────────────────────────┘│
                           (activate)                         │
                                                              │
                   ──────────────────────────────────────────┘
                           (activate from archived)
```

---

## Status Definitions

| Status           | ความหมาย                       | สามารถแก้ไขได้ | สามารถเปลี่ยนสถานะได้   | สามารถลบได้ | แสดงใน UI |
| ---------------- | ------------------------------ | -------------- | ----------------------- | ----------- | --------- |
| `active`         | ใช้งานปกติ                     | ✅             | ✅ → suspended/archived | ❌          | ✅        |
| `suspended`      | ระงับชั่วคราว                  | ❌             | ✅ → active/archived    | ❌          | ✅        |
| `archived`       | เก็บถาวร (ไม่ใช้งานแล้ว)       | ❌             | ✅ → active             | ✅          | ✅        |
| `deleted` (soft) | ถูกลบ (deleted_at IS NOT NULL) | ❌             | ❌                      | ❌          | ❌        |

---

## Status Transitions

### Allowed Transitions

| From        | To          | Action             | Business Rule         |
| ----------- | ----------- | ------------------ | --------------------- |
| `active`    | `suspended` | ระงับชั่วคราว      | ไม่ใช่ default branch |
| `active`    | `archived`  | เก็บถาวร           | ไม่ใช่ default branch |
| `suspended` | `active`    | เปิดใช้งานอีกครั้ง | -                     |
| `suspended` | `archived`  | เก็บถาวร           | ไม่ใช่ default branch |
| `archived`  | `active`    | เปิดใช้งานอีกครั้ง | -                     |
| `archived`  | `deleted`   | **Soft Delete**    | ไม่ใช่ default branch |

### Blocked Transitions

| From       | To                                        | Reason                                                |
| ---------- | ----------------------------------------- | ----------------------------------------------------- |
| `archived` | `suspended`                               | ต้อง activate ก่อน แล้วค่อย suspend                   |
| `deleted`  | ใดๆ                                       | ไม่สามารถ recover จาก soft delete                     |
| any        | `archived/suspended/deleted` (if default) | Default branch จะไม่สามารถเปลี่ยนสถานะเป็น non-active |

---

## Soft Delete Flow

### เงื่อนไขก่อน Delete

1. **ไม่ใช่ Default Branch** - สาขาหลักไม่สามารถลบได้
2. **ต้องมีสถานะ `archived`** - ต้องเก็บถาวรก่อนจึงจะลบได้

### Flow

```
┌─────────────────────────────────────────────────────────────┐
│  User clicks "Delete" on archived branch                    │
└────────────────────────────┬────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend: Check canDelete(branch)                          │
│  - branch.status === 'archived'                             │
│  - !branch.isDefault                                        │
└────────────────────────────┬────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend: Show confirmation dialog                         │
│  "Are you sure you want to delete {name}?"                  │
└────────────────────────────┬────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  API: DELETE /admin/branches/:id                            │
│  - Validate branch exists                                   │
│  - Validate status === 'archived'                           │
│  - Validate is_default === false                            │
└────────────────────────────┬────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Repository: Update branches SET                            │
│    deleted_at = now(),                                      │
│    deleted_by = :actor_id                                   │
│  WHERE id = :id                                             │
│    AND company_id = :company_id                             │
│    AND status = 'archived'                                  │
│    AND is_default = FALSE                                   │
└────────────────────────────┬────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Response: 204 No Content                                   │
│  Branch no longer appears in UI                             │
└─────────────────────────────────────────────────────────────┘
```

---

## API Error Responses

| Status | Error                                     | Cause                                   |
| ------ | ----------------------------------------- | --------------------------------------- |
| 400    | `cannot delete default branch`            | Trying to delete a default branch       |
| 400    | `branch must be archived before deletion` | Branch status is not `archived`         |
| 404    | `branch not found`                        | Branch doesn't exist or already deleted |

---

## Database Schema

### Soft Delete Columns

```sql
-- Added to branches table
deleted_at TIMESTAMPTZ DEFAULT NULL,  -- When soft-deleted (NULL = not deleted)
deleted_by UUID REFERENCES users(id)  -- Who deleted
```

### Index for Query Performance

```sql
-- Efficiently filter non-deleted branches
CREATE INDEX branches_deleted_at_idx
ON branches (deleted_at)
WHERE deleted_at IS NULL;
```

---

## Repository Queries

### List (excludes deleted)

```sql
SELECT * FROM branches
WHERE company_id = $1 AND deleted_at IS NULL
ORDER BY is_default DESC, code ASC
```

### Get by ID (excludes deleted)

```sql
SELECT * FROM branches
WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
```

### Soft Delete

```sql
UPDATE branches
SET deleted_at = now(), deleted_by = $1, updated_at = now()
WHERE id = $2
  AND company_id = $3
  AND is_default = FALSE
  AND status = 'archived'
```

---

## UI Behavior

### Action Menu for Branches

| Status      | Available Actions                          |
| ----------- | ------------------------------------------ |
| `active`    | Edit, Set as Default\*, Suspend, Archive   |
| `suspended` | Activate, Archive                          |
| `archived`  | Activate, **Delete** (red, with separator) |

\*Set as Default: only shown if not already default

### Delete Button

- Displayed **only** for `archived` branches
- Styled with `text-destructive` (red color)
- Has separator before it in dropdown menu
- Shows confirmation dialog before actual deletion

### Confirmation Dialog

- Title: "ยืนยันการลบ" / "Confirm Delete"
- Description: "คุณแน่ใจหรือไม่ว่าต้องการลบสาขา {name}? การดำเนินการนี้ไม่สามารถย้อนกลับได้"
- Confirm button: Red with "Delete" text

---

## Translation Keys

### Thai (th.json)

```json
{
  "Branches": {
    "deleteTitle": "ยืนยันการลบ",
    "deleteDescription": "คุณแน่ใจหรือไม่ว่าต้องการลบสาขา {name}? การดำเนินการนี้ไม่สามารถย้อนกลับได้",
    "deleteSuccess": "ลบสาขาสำเร็จ",
    "deleteError": "ไม่สามารถลบสาขา"
  }
}
```

### English (en.json)

```json
{
  "Branches": {
    "deleteTitle": "Confirm Delete",
    "deleteDescription": "Are you sure you want to delete {name}? This action cannot be undone.",
    "deleteSuccess": "Branch deleted successfully",
    "deleteError": "Failed to delete branch"
  }
}
```

---

## Migration

### Up Migration

```sql
-- Add soft delete columns to branches table
ALTER TABLE branches ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE branches ADD COLUMN deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX branches_deleted_at_idx ON branches (deleted_at) WHERE deleted_at IS NULL;
```

### Down Migration

```sql
DROP INDEX IF EXISTS branches_deleted_at_idx;
ALTER TABLE branches DROP COLUMN IF EXISTS deleted_by;
ALTER TABLE branches DROP COLUMN IF EXISTS deleted_at;
```

---

## Summary

1. **Soft Delete** จะทำงานได้เฉพาะสาขาที่มีสถานะ `archived` เท่านั้น
2. **Default Branch** ไม่สามารถลบได้ (ต้องเปลี่ยน default ไปยังสาขาอื่นก่อน)
3. สาขาที่ถูก soft delete จะ **ไม่แสดงใน UI** โดยอัตโนมัติ
4. ข้อมูลยังคงอยู่ในฐานข้อมูล (สามารถ recover ได้ทางเทคนิค หากจำเป็น)
