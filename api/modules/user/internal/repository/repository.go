package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

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
	UpdatedAt    time.Time    `db:"updated_at"`
	LastLogin    sql.NullTime `db:"last_login_at"`
}

type UserListResult struct {
	Users []UserRecord
	Total int
}

func (r Repository) ListUsers(ctx context.Context, page, limit int, roleFilter string, companyID uuid.UUID) (UserListResult, error) {
	db := r.dbCtx(ctx)
	offset := (page - 1) * limit

	var args []interface{}
	var where []string
	where = append(where, "u.deleted_at IS NULL")

	// Always filter by company via user_company_roles
	if companyID != uuid.Nil {
		args = append(args, companyID)
		where = append(where, fmt.Sprintf("ucr.company_id = $%d", len(args)))
	}

	if roleFilter != "" {
		args = append(args, roleFilter)
		where = append(where, fmt.Sprintf("u.user_role = $%d", len(args)))
	}

	whereClause := strings.Join(where, " AND ")
	args = append(args, limit, offset)

	query := fmt.Sprintf(`
SELECT DISTINCT u.id, u.username, u.password_hash, u.user_role, u.created_at, u.updated_at,
  COALESCE((
    SELECT l.login_at FROM user_access_logs l
    WHERE l.user_id = u.id AND l.status = 'success'
    ORDER BY l.login_at DESC LIMIT 1
  ), NULL) AS last_login_at
FROM users u
JOIN user_company_roles ucr ON ucr.user_id = u.id
WHERE %s
ORDER BY u.username ASC
LIMIT $%d OFFSET $%d`, whereClause, len(args)-1, len(args))

	rows, err := db.QueryxContext(ctx, query, args...)
	if err != nil {
		return UserListResult{}, err
	}
	defer rows.Close()

	var users []UserRecord
	for rows.Next() {
		var u UserRecord
		if err := rows.StructScan(&u); err != nil {
			return UserListResult{}, err
		}
		users = append(users, u)
	}

	countQuery := fmt.Sprintf(`
SELECT COUNT(DISTINCT u.id) 
FROM users u 
JOIN user_company_roles ucr ON ucr.user_id = u.id 
WHERE %s`, whereClause)
	var total int
	if err := db.GetContext(ctx, &total, countQuery, args[:len(args)-2]...); err != nil {
		return UserListResult{}, err
	}

	return UserListResult{Users: users, Total: total}, nil
}

func (r Repository) CreateUser(ctx context.Context, username, passwordHash, role string, actor uuid.UUID) (*UserRecord, error) {
	db := r.dbCtx(ctx)
	var rec UserRecord
	const q = `
INSERT INTO users (username, password_hash, user_role, created_by, updated_by)
VALUES ($1, $2, $3, $4, $4)
RETURNING id, username, password_hash, user_role, created_at, updated_at`
	if err := db.GetContext(ctx, &rec, q, username, passwordHash, role, actor); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) GetUser(ctx context.Context, id uuid.UUID) (*UserRecord, error) {
	db := r.dbCtx(ctx)
	var rec UserRecord
	const q = `
SELECT u.id, u.username, u.password_hash, u.user_role, u.created_at, u.updated_at,
  COALESCE((
    SELECT l.login_at FROM user_access_logs l
    WHERE l.user_id = u.id AND l.status='success'
    ORDER BY l.login_at DESC LIMIT 1
  ), NULL) AS last_login_at
FROM users u
WHERE u.id = $1 AND u.deleted_at IS NULL
LIMIT 1`
	if err := db.GetContext(ctx, &rec, q, id); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r Repository) UpdateRole(ctx context.Context, id uuid.UUID, role string, actor uuid.UUID) error {
	db := r.dbCtx(ctx)
	const q = `UPDATE users SET user_role=$1, updated_by=$2 WHERE id=$3 AND deleted_at IS NULL`
	res, err := db.ExecContext(ctx, q, role, actor, id)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r Repository) ResetPassword(ctx context.Context, id uuid.UUID, passwordHash string, actor uuid.UUID) error {
	db := r.dbCtx(ctx)
	const q = `UPDATE users SET password_hash=$1, updated_by=$2 WHERE id=$3 AND deleted_at IS NULL`
	res, err := db.ExecContext(ctx, q, passwordHash, actor, id)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r Repository) SoftDelete(ctx context.Context, id uuid.UUID, actor uuid.UUID) error {
	db := r.dbCtx(ctx)
	const q = `UPDATE users SET deleted_at=now(), deleted_by=$1 WHERE id=$2 AND deleted_at IS NULL`
	res, err := db.ExecContext(ctx, q, actor, id)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// ===== Methods for superadmin contracts =====

// AssignUserToCompany assigns a user to a company with a role
func (r Repository) AssignUserToCompany(ctx context.Context, userID, companyID uuid.UUID, role string, actorID uuid.UUID) error {
	db := r.dbCtx(ctx)
	const q = `INSERT INTO user_company_roles (user_id, company_id, role, created_by)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id, company_id) DO UPDATE SET role = EXCLUDED.role`
	_, err := db.ExecContext(ctx, q, userID, companyID, role, actorID)
	return err
}

// AssignUserToBranch assigns a user to a branch
func (r Repository) AssignUserToBranch(ctx context.Context, userID, branchID, actorID uuid.UUID) error {
	db := r.dbCtx(ctx)
	const q = `INSERT INTO user_branch_access (user_id, branch_id, created_by)
		VALUES ($1, $2, $3)
		ON CONFLICT DO NOTHING`
	_, err := db.ExecContext(ctx, q, userID, branchID, actorID)
	return err
}
