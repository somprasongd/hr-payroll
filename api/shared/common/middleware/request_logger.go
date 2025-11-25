package middleware

import (
	"runtime/debug"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/shared/common/logger"
)

// RequestLogger adds request id and logs access log.
func RequestLogger() fiber.Handler {
	return func(c fiber.Ctx) error {
		start := time.Now()
		method := c.Method()
		path := c.Path()

		requestID := c.Get("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}
		c.Set("X-Request-ID", requestID)

		reqLogger := logger.With(
			zap.String("request_id", requestID),
			zap.String("method", method),
			zap.String("path", path),
		)

		ctx := logger.NewContext(c.Context(), reqLogger)
		c.SetContext(ctx)

		defer func() {
			if r := recover(); r != nil {
				reqLogger.Error("panic recovered",
					zap.Any("error", r),
					zap.ByteString("stack", debug.Stack()),
				)
				panic(r)
			}
		}()

		err := c.Next()

		duration := time.Since(start)
		status := c.Response().StatusCode()

		if err != nil {
			reqLogger.Error("request error", zap.Error(err))
		}

		reqLogger.Info("request completed",
			zap.Int("status", status),
			zap.Duration("duration", duration))

		return err
	}
}
