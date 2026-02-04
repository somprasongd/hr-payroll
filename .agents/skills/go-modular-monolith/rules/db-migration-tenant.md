# db-migration-tenant

RLS policies for multi-tenancy.

## Why RLS

- Row-Level Security enforces tenant isolation at database level
- Prevents accidental data leakage between tenants
- Works with PostgreSQL session variables

## Migration File Example

```sql
-- migrations/001_create_products_table.up.sql

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    
    -- Multi-tenancy columns
    company_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    
    -- Audit columns
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    deleted_at TIMESTAMP,
    deleted_by UUID,
    
    -- Constraints
    UNIQUE(company_id, sku)
);

-- Indexes
CREATE INDEX idx_products_company_id ON products(company_id);
CREATE INDEX idx_products_branch_id ON products(branch_id);
CREATE INDEX idx_products_deleted_at ON products(deleted_at) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY products_tenant_isolation ON products
    USING (
        company_id = current_setting('app.current_company_id')::UUID
        AND branch_id = ANY(string_to_array(current_setting('app.allowed_branches'), ',')::UUID[])
    );
```

## Session Variables

Set in transaction via Transactor:
```go
setLocalConfig := func(name, value string) error {
    _, err := tx.ExecContext(ctx, "SELECT set_config($1, $2, true)", name, value)
    return err
}

// Set tenant context
setLocalConfig("app.current_company_id", tenant.CompanyID.String())
setLocalConfig("app.allowed_branches", tenant.BranchID.String())
```

## Policy Patterns

### Company Only
```sql
CREATE POLICY company_isolation ON table_name
    USING (company_id = current_setting('app.current_company_id')::UUID);
```

### Company + Branch
```sql
CREATE POLICY tenant_isolation ON table_name
    USING (
        company_id = current_setting('app.current_company_id')::UUID
        AND branch_id = current_setting('app.current_branch_id')::UUID
    );
```

### Company + Multiple Branches
```sql
CREATE POLICY multi_branch_isolation ON table_name
    USING (
        company_id = current_setting('app.current_company_id')::UUID
        AND branch_id = ANY(string_to_array(current_setting('app.allowed_branches'), ',')::UUID[])
    );
```

## Common Pitfalls

**Incorrect: Missing RLS enable**
```sql
-- ❌ Policy exists but not enforced
CREATE POLICY ...;  -- Missing ENABLE ROW LEVEL SECURITY
```

**Correct: Enable RLS first**
```sql
-- ✅ Enable before creating policy
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY ...;
```
