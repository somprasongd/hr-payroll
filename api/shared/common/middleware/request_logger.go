package middleware

import (
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
		requestID := c.Get("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}
		c.Set("X-Request-ID", requestID)

		ctx := logger.NewContext(c.Context(), logger.With(zap.String("request_id", requestID)))
		c.SetContext(ctx)

		err := c.Next()

		duration := time.Since(start)
		logger.FromContext(ctx).Info("request completed",
			zap.Int("status", c.Response().StatusCode()),
			zap.String("method", c.Method()),
			zap.String("path", c.Path()),
			zap.Duration("duration", duration),
		)

		return err
	}
}
