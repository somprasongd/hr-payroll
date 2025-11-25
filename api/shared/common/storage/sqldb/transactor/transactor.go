package transactor

import (
	"context"
	"fmt"

	"github.com/jmoiron/sqlx"

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
