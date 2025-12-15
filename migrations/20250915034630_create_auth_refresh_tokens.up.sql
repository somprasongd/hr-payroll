CREATE TABLE auth_refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX auth_refresh_tokens_user_idx ON auth_refresh_tokens(user_id);
CREATE UNIQUE INDEX auth_refresh_tokens_hash_idx ON auth_refresh_tokens(token_hash);