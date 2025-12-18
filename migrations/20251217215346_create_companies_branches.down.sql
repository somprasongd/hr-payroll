-- =========================================
-- Rollback: Multi-Branch Support - Phase 1
-- =========================================

-- Remove seed data first (handled by CASCADE)

-- Drop tables in reverse order
DROP TABLE IF EXISTS user_branch_access CASCADE;
DROP TABLE IF EXISTS user_company_roles CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
