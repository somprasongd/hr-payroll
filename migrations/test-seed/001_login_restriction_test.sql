-- Seed test data for Login Restriction tests
-- Creates companies with 'suspended' and 'archived' status

BEGIN;

-- 1. Create Suspended Company
DELETE FROM user_branch_access WHERE user_id = '019b970a-0001-7000-8000-000000000002';
DELETE FROM branches WHERE company_id = '019b970a-0001-7000-8000-000000000001';
DELETE FROM users WHERE id = '019b970a-0001-7000-8000-000000000002';
DELETE FROM companies WHERE id = '019b970a-0001-7000-8000-000000000001';

INSERT INTO companies (id, code, name, status, created_by, updated_by)
VALUES ('019b970a-0001-7000-8000-000000000001', 'COMP_SUSP', 'Suspended Company', 'suspended', 
        (SELECT id FROM users WHERE username='admin' LIMIT 1), 
        (SELECT id FROM users WHERE username='admin' LIMIT 1));

-- Create user admin_susp with password 'changeme'
INSERT INTO users (id, username, password_hash, user_role, created_by, updated_by)
VALUES ('019b970a-0001-7000-8000-000000000002', 'admin_susp', 
        '$argon2id$v=19$m=65536,t=3,p=4$vdCnms0qqpwQwsGkU9tONQ$/wvzZ56+cOqNU2AUQzQxmKAr0x+JrFCL7Qa1YeQxvpg', 
        'admin', 
        (SELECT id FROM users WHERE username='admin' LIMIT 1), 
        (SELECT id FROM users WHERE username='admin' LIMIT 1));

INSERT INTO branches (id, company_id, code, name, status, is_default, created_by, updated_by)
VALUES ('019b970a-0001-7000-8000-000000000003', '019b970a-0001-7000-8000-000000000001', '00000', 
        'สำนักงานใหญ่', 'active', TRUE, 
        (SELECT id FROM users WHERE username='admin' LIMIT 1), 
        (SELECT id FROM users WHERE username='admin' LIMIT 1));

INSERT INTO user_branch_access (user_id, branch_id, created_by)
VALUES ('019b970a-0001-7000-8000-000000000002', '019b970a-0001-7000-8000-000000000003', 
        (SELECT id FROM users WHERE username='admin' LIMIT 1));

-- 2. Create Archived Company
DELETE FROM user_branch_access WHERE user_id = '019b970a-0002-7000-8000-000000000002';
DELETE FROM branches WHERE company_id = '019b970a-0002-7000-8000-000000000001';
DELETE FROM users WHERE id = '019b970a-0002-7000-8000-000000000002';
DELETE FROM companies WHERE id = '019b970a-0002-7000-8000-000000000001';

INSERT INTO companies (id, code, name, status, created_by, updated_by)
VALUES ('019b970a-0002-7000-8000-000000000001', 'COMP_ARCH', 'Archived Company', 'archived', 
        (SELECT id FROM users WHERE username='admin' LIMIT 1), 
        (SELECT id FROM users WHERE username='admin' LIMIT 1));

-- Create user admin_arch with password 'changeme'
INSERT INTO users (id, username, password_hash, user_role, created_by, updated_by)
VALUES ('019b970a-0002-7000-8000-000000000002', 'admin_arch', 
        '$argon2id$v=19$m=65536,t=3,p=4$vdCnms0qqpwQwsGkU9tONQ$/wvzZ56+cOqNU2AUQzQxmKAr0x+JrFCL7Qa1YeQxvpg', 
        'admin', 
        (SELECT id FROM users WHERE username='admin' LIMIT 1), 
        (SELECT id FROM users WHERE username='admin' LIMIT 1));

INSERT INTO branches (id, company_id, code, name, status, is_default, created_by, updated_by)
VALUES ('019b970a-0002-7000-8000-000000000003', '019b970a-0002-7000-8000-000000000001', '00000', 
        'สำนักงานใหญ่', 'active', TRUE, 
        (SELECT id FROM users WHERE username='admin' LIMIT 1), 
        (SELECT id FROM users WHERE username='admin' LIMIT 1));

INSERT INTO user_branch_access (user_id, branch_id, created_by)
VALUES ('019b970a-0002-7000-8000-000000000002', '019b970a-0002-7000-8000-000000000003', 
        (SELECT id FROM users WHERE username='admin' LIMIT 1));

COMMIT;
