# shared-optionaluuid

Optional UUID type for optional foreign key fields.

## Why OptionalUUID

Standard `uuid.UUID` ไม่สามารถแยกแยะระหว่าง "ไม่ส่งค่า" กับ "ส่งค่าว่าง" ได้:
- JSON `null` → ควรเป็น nil
- JSON `""` (empty string) → ควรเป็น nil  
- JSON `"550e8400-e29b-41d4-a716-446655440000"` → ควรเป็น UUID

## File: api/shared/common/types/optional_uuid.go

```go
package types

import (
    "encoding/json"
    "strings"
    "github.com/google/uuid"
)

// OptionalUUID allows binding empty strings to nil while still accepting valid UUIDs.
type OptionalUUID struct {
    value *uuid.UUID
}

// UnmarshalJSON supports "", null, or a valid UUID string.
func (o *OptionalUUID) UnmarshalJSON(data []byte) error {
    // Treat explicit null as nil
    if string(data) == "null" {
        o.value = nil
        return nil
    }

    var raw string
    if err := json.Unmarshal(data, &raw); err != nil {
        return err
    }

    raw = strings.TrimSpace(raw)
    if raw == "" {
        o.value = nil
        return nil
    }

    id, err := uuid.Parse(raw)
    if err != nil {
        return err
    }
    o.value = &id
    return nil
}

// MarshalJSON outputs the UUID string or null.
func (o OptionalUUID) MarshalJSON() ([]byte, error) {
    if o.value == nil {
        return []byte("null"), nil
    }
    return json.Marshal(o.value.String())
}

// Ptr returns the underlying UUID pointer.
func (o OptionalUUID) Ptr() *uuid.UUID {
    return o.value
}

// IsNil checks if the value is nil.
func (o OptionalUUID) IsNil() bool {
    return o.value == nil
}

// UUID returns the UUID value (zero value if nil).
func (o OptionalUUID) UUID() uuid.UUID {
    if o.value == nil {
        return uuid.Nil
    }
    return *o.value
}
```

## Usage in Request Body

```go
package create

type RequestBody struct {
    Name         string       `json:"name" validate:"required"`
    DepartmentID OptionalUUID `json:"departmentId"`  // Optional FK
    PositionID   OptionalUUID `json:"positionId"`    // Optional FK
    ManagerID    OptionalUUID `json:"managerId"`     // Optional FK
}

func (p RequestBody) ToRecord() repository.Record {
    return repository.Record{
        Name:         p.Name,
        DepartmentID: p.DepartmentID.Ptr(),  // nil if empty/null
        PositionID:   p.PositionID.Ptr(),
        ManagerID:    p.ManagerID.Ptr(),
    }
}
```

## JSON Examples

```json
// Case 1: ไม่ส่ง field → Go จะเป็นค่า zero (value=nil)
{
    "name": "John"
}

// Case 2: ส่ง null → แปลงเป็น nil
{
    "name": "John",
    "departmentId": null
}

// Case 3: ส่ง empty string → แปลงเป็น nil
{
    "name": "John",
    "departmentId": ""
}

// Case 4: ส่ง valid UUID → แปลงเป็น *uuid.UUID
{
    "name": "John",
    "departmentId": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Database Insert

```go
// repository.go
const q = `
    INSERT INTO employees (name, department_id, position_id)
    VALUES (:name, :department_id, :position_id)
`

params := map[string]interface{}{
    "name":          req.Name,
    "department_id": req.DepartmentID.Ptr(),  // nil → NULL in DB
    "position_id":   req.PositionID.Ptr(),
}
```

## Common Pitfalls

**Incorrect: Using uuid.UUID directly**
```go
// ❌ Can't distinguish between empty and not sent
type RequestBody struct {
    DepartmentID uuid.UUID `json:"departmentId"`  // "": "00000000-0000-0000-0000-000000000000"
}
```

**Correct: Use OptionalUUID**
```go
// ✅ nil = not set, *uuid.UUID = has value
type RequestBody struct {
    DepartmentID OptionalUUID `json:"departmentId"`
}
```

**Incorrect: Manual checking**
```go
// ❌ Verbose and error-prone
if req.DepartmentID != "" {
    id, _ := uuid.Parse(req.DepartmentID)
    record.DepartmentID = &id
}
```

**Correct: Automatic unmarshaling**
```go
// ✅ Clean and type-safe
record.DepartmentID = req.DepartmentID.Ptr()  // Handles nil automatically
```

## Related

- **Validation**: Use with `validate:"omitempty"` tag
- **Database**: Works with sqlx named parameters
- **Response**: MarshalJSON returns null for nil values
