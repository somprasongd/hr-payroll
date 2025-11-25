package repository

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/shared/common/logger"
	"hrms/shared/common/storage/sqldb/transactor"
)

type Repository struct {
	dbCtx transactor.DBTXContext
}

func NewRepository(dbCtx transactor.DBTXContext) Repository {
	return Repository{dbCtx: dbCtx}
}

type UserRecord struct {
	ID           uuid.UUID    `db:"id"`
	Username     string       `db:"username"`
	PasswordHash string       `db:"password_hash"`
	Role         string       `db:"user_role"`
	CreatedAt    time.Time    `db:"created_at"`
	LastLogin    sql.NullTime `db:"last_login_at"`
}

type RefreshTokenRecord struct {
	ID        uuid.UUID    `db:"id"`
	UserID    uuid.UUID    `db:"user_id"`
	TokenHash string       `db:"token_hash"`
	RevokedAt sql.NullTime `db:"revoked_at"`
	ExpiresAt time.Time    `db:"expires_at"`
	CreatedAt time.Time    `db:"created_at"`
}

func (r Repository) FindUserByUsername(ctx context.Context, username string) (*UserRecord, error) {
	db := r.dbCtx(ctx)
	var user UserRecord
	const q = `
SELECT u.id, u.username, u.password_hash, u.user_role, u.created_at,
  COALESCE((
    SELECT l.login_at FROM user_access_logs l
    WHERE l.user_id = u.id AND l.status = 'success'
    ORDER BY l.login_at DESC
    LIMIT 1
  ), NULL) AS last_login_at
FROM users u
WHERE u.username = $1 AND u.deleted_at IS NULL
LIMIT 1`
	if err := db.GetContext(ctx, &user, q, username); err != nil {
		return nil, err
	}
	return &user, nil
}

func (r Repository) InsertRefreshToken(ctx context.Context, tokenHash string, userID uuid.UUID, expiresAt time.Time) error {
	db := r.dbCtx(ctx)
	const q = `INSERT INTO auth_refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`
	_, err := db.ExecContext(ctx, q, userID, tokenHash, expiresAt)
	return err
}

func (r Repository) GetRefreshToken(ctx context.Context, tokenHash string) (*RefreshTokenRecord, error) {
	db := r.dbCtx(ctx)
	var rec RefreshTokenRecord
	const q = `SELECT id, user_id, token_hash, revoked_at, expires_at, created_at
FROM auth_refresh_tokens WHERE token_hash = $1 LIMIT 1`
	if err := db.GetContext(ctx, &rec, q, tokenHash); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) RevokeRefreshToken(ctx context.Context, tokenHash string) error {
	db := r.dbCtx(ctx)
	const q = `UPDATE auth_refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`
	_, err := db.ExecContext(ctx, q, tokenHash)
	return err
}

func (r Repository) LogAccess(ctx context.Context, userID uuid.UUID, status string, ip, ua string) {
	db := r.dbCtx(ctx)
	const q = `INSERT INTO user_access_logs (user_id, status, ip_address, user_agent) VALUES ($1,$2,$3,$4)`
	if _, err := db.ExecContext(ctx, q, userID, status, ip, ua); err != nil {
		logger.FromContext(ctx).Warn("failed to log access", zap.Error(err))
	}
}
