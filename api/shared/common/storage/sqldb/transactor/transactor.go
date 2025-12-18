package transactor

import (
	"context"
	"fmt"
	"strconv"

	"github.com/jmoiron/sqlx"

	"hrms/shared/common/contextx"
	"hrms/shared/common/logger"
)

type PostCommitHook func(ctx context.Context) error

type Transactor interface {
	WithinTransaction(ctx context.Context, txFunc func(ctxWithTx context.Context, registerPostCommitHook func(PostCommitHook)) error) error
}

type (
	sqlxDBGetter               func(context.Context) sqlxDB
	nestedTransactionsStrategy func(sqlxDB, *sqlx.Tx) (sqlxDB, sqlxTx)
)

type sqlTransactor struct {
	sqlxDBGetter
	nestedTransactionsStrategy
}

type Option func(*sqlTransactor)

func New(db *sqlx.DB, opts ...Option) (Transactor, DBTXContext) {
	t := &sqlTransactor{
		sqlxDBGetter: func(ctx context.Context) sqlxDB {
			if tx := txFromContext(ctx); tx != nil {
				return tx
			}
			return db
		},
		nestedTransactionsStrategy: NestedTransactionsNone,
	}

	for _, opt := range opts {
		opt(t)
	}

	dbGetter := func(ctx context.Context) DBTX {
		if tx := txFromContext(ctx); tx != nil {
			return tx
		}
		return db
	}

	return t, dbGetter
}

func WithNestedTransactionStrategy(strategy nestedTransactionsStrategy) Option {
	return func(t *sqlTransactor) {
		t.nestedTransactionsStrategy = strategy
	}
}

func (t *sqlTransactor) WithinTransaction(ctx context.Context, txFunc func(ctxWithTx context.Context, registerPostCommitHook func(PostCommitHook)) error) error {
	currentDB := t.sqlxDBGetter(ctx)

	tx, err := currentDB.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	setLocalConfig := func(name, value string) error {
		_, err := tx.ExecContext(ctx, "SELECT set_config($1, $2, true)", name, value)
		return err
	}

	// Set RLS session variables from tenant context
	if tenant, ok := contextx.TenantFromContext(ctx); ok {
		// Set company ID for RLS
		if err := setLocalConfig("app.current_company_id", tenant.CompanyID.String()); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("failed to set tenant company: %w", err)
		}
		// Set allowed branches for RLS
		if err := setLocalConfig("app.allowed_branches", tenant.BranchIDsCSV()); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("failed to set tenant branches: %w", err)
		}
		// Set admin flag for RLS
		if err := setLocalConfig("app.is_admin", strconv.FormatBool(tenant.IsAdmin)); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("failed to set tenant admin flag: %w", err)
		}
	}

	// Set user context for RLS (always, even without tenant)
	if user, ok := contextx.UserFromContext(ctx); ok {
		if err := setLocalConfig("app.user_role", user.Role); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("failed to set user role: %w", err)
		}
		if err := setLocalConfig("app.current_user_id", user.ID.String()); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("failed to set current user id: %w", err)
		}
	}

	var hooks []PostCommitHook

	registerPostCommitHook := func(hook PostCommitHook) {
		hooks = append(hooks, hook)
	}

	newDB, currentTX := t.nestedTransactionsStrategy(currentDB, tx)
	defer func() {
		_ = currentTX.Rollback()
	}()
	ctxWithTx := txToContext(ctx, newDB)

	if err := txFunc(ctxWithTx, registerPostCommitHook); err != nil {
		return err
	}

	if err := currentTX.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	log := logger.FromContext(ctx)

	go func() {
		for _, hook := range hooks {
			func(h PostCommitHook) {
				defer func() {
					if r := recover(); r != nil {
						log.Error(fmt.Sprintf("post-commit hook panic: %v", r))
					}
				}()
				if err := h(ctx); err != nil {
					log.Error(fmt.Sprintf("post-commit hook error: %v", err))
				}
			}(hook)
		}
	}()

	return nil
}

func IsWithinTransaction(ctx context.Context) bool {
	return ctx.Value(transactorKey{}) != nil
}
