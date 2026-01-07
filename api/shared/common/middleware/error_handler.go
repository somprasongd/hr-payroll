package middleware

import (
	"errors"
	"net/http"

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
			var ae *errs.AppError
			if errors.As(err, &ae) {
				return response.ProblemJSON(c, ae)
			}

			var fe *fiber.Error
			if errors.As(err, &fe) {
				if fe.Code >= fiber.StatusInternalServerError {
					logger.FromContext(c.Context()).Error("http error", zap.Error(err))
					return response.ProblemJSON(c, errs.Internal("internal server error"))
				}

				title := http.StatusText(fe.Code)
				if title == "" {
					title = "Error"
				}

				return c.Status(fe.Code).JSON(response.Problem{
					Type:   "about:blank",
					Title:  title,
					Status: fe.Code,
					Detail: fe.Message,
				})
			}

			logger.FromContext(c.Context()).Error("unhandled error", zap.Error(err))
			return response.ProblemJSON(c, errs.Internal("internal server error"))
		}
		return nil
	}
}
