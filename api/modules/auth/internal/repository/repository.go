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

// ========== Tenant Access Methods ==========

// HasCompanyAccess checks if user has access to a company
func (r Repository) HasCompanyAccess(ctx context.Context, userID, companyID uuid.UUID) bool {
	db := r.dbCtx(ctx)
	var count int
	err := db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM user_company_roles WHERE user_id = $1 AND company_id = $2`,
		userID, companyID)
	return err == nil && count > 0
}

// GetUserCompanyRole returns user's role in a company
func (r Repository) GetUserCompanyRole(ctx context.Context, userID, companyID uuid.UUID) (string, error) {
	db := r.dbCtx(ctx)
	var role string
	err := db.GetContext(ctx, &role,
		`SELECT role FROM user_company_roles WHERE user_id = $1 AND company_id = $2`,
		userID, companyID)
	return role, err
}

// CompanyInfo for auth responses
type CompanyInfo struct {
	ID     uuid.UUID `db:"id" json:"id"`
	Code   string    `db:"code" json:"code"`
	Name   string    `db:"name" json:"name"`
	Status string    `db:"status" json:"status"`
	Role   string    `db:"-" json:"role"`
}

// BranchInfo for auth responses
type BranchInfo struct {
	ID        uuid.UUID `db:"id" json:"id"`
	CompanyID uuid.UUID `db:"company_id" json:"companyId"`
	Code      string    `db:"code" json:"code"`
	Name      string    `db:"name" json:"name"`
	Status    string    `db:"status" json:"status"`
	IsDefault bool      `db:"is_default" json:"isDefault"`
}

// GetCompanyByID returns company by ID
func (r Repository) GetCompanyByID(ctx context.Context, companyID uuid.UUID) (*CompanyInfo, error) {
	db := r.dbCtx(ctx)
	var out CompanyInfo
	const q = `SELECT id, code, name, status FROM companies WHERE id = $1`
	if err := db.GetContext(ctx, &out, q, companyID); err != nil {
		return nil, err
	}
	return &out, nil
}

// GetUserCompanies returns all companies a user has access to
func (r Repository) GetUserCompanies(ctx context.Context, userID uuid.UUID) ([]CompanyInfo, error) {
	db := r.dbCtx(ctx)
	var out []CompanyInfo
	const q = `
		SELECT c.id, c.code, c.name, c.status
		FROM companies c
		JOIN user_company_roles ucr ON ucr.company_id = c.id
		WHERE ucr.user_id = $1 AND c.status = 'active'
		ORDER BY c.name`
	if err := db.SelectContext(ctx, &out, q, userID); err != nil {
		return nil, err
	}
	// Add roles
	for i := range out {
		role, _ := r.GetUserCompanyRole(ctx, userID, out[i].ID)
		out[i].Role = role
	}
	return out, nil
}

// GetAllBranches returns all branches for a company (for admin)
func (r Repository) GetAllBranches(ctx context.Context, companyID uuid.UUID) ([]BranchInfo, error) {
	db := r.dbCtx(ctx)
	var out []BranchInfo
	const q = `
		SELECT id, company_id, code, name, status, is_default
		FROM branches
		WHERE company_id = $1 AND status = 'active'
		ORDER BY is_default DESC, code ASC`
	if err := db.SelectContext(ctx, &out, q, companyID); err != nil {
		return nil, err
	}
	return out, nil
}

// GetUserBranches returns branches a user can access
func (r Repository) GetUserBranches(ctx context.Context, userID, companyID uuid.UUID) ([]BranchInfo, error) {
	db := r.dbCtx(ctx)
	var out []BranchInfo
	const q = `
		SELECT b.id, b.company_id, b.code, b.name, b.status, b.is_default
		FROM branches b
		JOIN user_branch_access uba ON uba.branch_id = b.id
		WHERE uba.user_id = $1 AND b.company_id = $2 AND b.status = 'active'
		ORDER BY b.is_default DESC, b.code ASC`
	if err := db.SelectContext(ctx, &out, q, userID, companyID); err != nil {
		return nil, err
	}
	return out, nil
}

// GetAllUserBranches returns all branches a user can access across all companies
func (r Repository) GetAllUserBranches(ctx context.Context, userID uuid.UUID) ([]BranchInfo, error) {
	db := r.dbCtx(ctx)
	var out []BranchInfo
	const q = `
		SELECT b.id, b.company_id, b.code, b.name, b.status, b.is_default
		FROM branches b
		JOIN user_branch_access uba ON uba.branch_id = b.id
		WHERE uba.user_id = $1 AND b.status = 'active'
		ORDER BY b.company_id, b.is_default DESC, b.code ASC`
	if err := db.SelectContext(ctx, &out, q, userID); err != nil {
		return nil, err
	}
	return out, nil
}
