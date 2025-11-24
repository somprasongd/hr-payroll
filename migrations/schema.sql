CREATE EXTENSION pg_uuidv7;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuidv7(),    -- PK สำหรับภายใน
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_account_created ON account(created_at DESC);
