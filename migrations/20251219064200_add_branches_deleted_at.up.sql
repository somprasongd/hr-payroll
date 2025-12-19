-- =========================================
-- Add soft delete support for branches
-- =========================================

-- Add deleted_at column for soft delete
ALTER TABLE branches ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_by column to track who deleted
ALTER TABLE branches ADD COLUMN deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index for efficient filtering of non-deleted branches
CREATE INDEX branches_deleted_at_idx ON branches (deleted_at) WHERE deleted_at IS NULL;

-- Comment explaining the soft delete logic
COMMENT ON COLUMN branches.deleted_at IS 'Soft delete timestamp. Branch can only be deleted when status is archived.';
