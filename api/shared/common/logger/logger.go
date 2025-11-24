package logger

import (
	"context"

	"go.uber.org/zap"
)

var (
	defaultLogger *zap.Logger
)

func Init(appName string) (func(), error) {
	cfg := zap.NewProductionConfig()
	cfg.InitialFields = map[string]interface{}{"app": appName}
	l, err := cfg.Build()
	if err != nil {
		return nil, err
	}
	defaultLogger = l
	return func() {
		_ = l.Sync()
	}, nil
}

func Log() *zap.Logger {
	if defaultLogger == nil {
		l, _ := zap.NewProduction()
		defaultLogger = l
	}
	return defaultLogger
}

func With(fields ...zap.Field) *zap.Logger {
	return Log().With(fields...)
}

type ctxKey struct{}

// NewContext injects logger into context.
func NewContext(ctx context.Context, l *zap.Logger) context.Context {
	return context.WithValue(ctx, ctxKey{}, l)
}

// FromContext returns logger from context if any.
func FromContext(ctx context.Context) *zap.Logger {
	if ctx == nil {
		return Log()
	}
	if l, ok := ctx.Value(ctxKey{}).(*zap.Logger); ok && l != nil {
		return l
	}
	return Log()
}
