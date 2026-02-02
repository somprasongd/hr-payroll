-- =============================================
-- Company Bank Accounts
-- =============================================

-- บัญชีธนาคารของบริษัท (Central หรือ Branch-Specific)
CREATE TABLE company_bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    bank_id UUID NOT NULL REFERENCES banks(id),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE, -- NULL = บัญชีกลาง (Central), NOT NULL = บัญชีเฉพาะสาขา
    account_number VARCHAR(50) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id)
);

-- Index for filtering by company
CREATE INDEX company_bank_accounts_company_idx ON company_bank_accounts (company_id) WHERE deleted_at IS NULL;

-- Index for filtering by branch
CREATE INDEX company_bank_accounts_branch_idx ON company_bank_accounts (branch_id) WHERE deleted_at IS NULL AND branch_id IS NOT NULL;

-- updated_at trigger
CREATE TRIGGER tg_company_bank_accounts_set_updated
BEFORE UPDATE ON company_bank_accounts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Comment explaining the branch_id logic
COMMENT ON COLUMN company_bank_accounts.branch_id IS 'NULL = Central Account (visible to all branches), NOT NULL = Branch-specific account (visible only to that branch)';
