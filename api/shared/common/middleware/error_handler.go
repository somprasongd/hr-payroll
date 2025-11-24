package middleware

import (
	"github.com/gofiber/fiber/v3"
	"go.uber.org/zap"

	"hrms/shared/common/errs"
	"hrms/shared/common/logger"
	"hrms/shared/common/response"
)

// ErrorHandler converts returned errors into RFC7807 responses.
func ErrorHandler() fiber.Handler {
	return func(c fiber.Ctx) error {
		if err := c.Next(); err != nil {
			if ae, ok := err.(*errs.AppError); ok {
				return response.ProblemJSON(c, ae)
			}

			logger.Log().Error("unhandled error", zap.Error(err))
			return response.ProblemJSON(c, errs.Internal("internal server error"))
		}
		return nil
	}
}
