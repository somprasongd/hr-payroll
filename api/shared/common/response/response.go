package response

import (
	"net/http"

	"github.com/gofiber/fiber/v3"

	"hrms/shared/common/errs"
)

type Problem struct {
	Type     string      `json:"type"`
	Title    string      `json:"title"`
	Status   int         `json:"status"`
	Detail   string      `json:"detail,omitempty"`
	Instance string      `json:"instance,omitempty"`
	Extra    interface{} `json:"extra,omitempty"`
}

func JSON(c fiber.Ctx, status int, payload interface{}) error {
	return c.Status(status).JSON(payload)
}

func ProblemJSON(c fiber.Ctx, err error) error {
	ae, ok := err.(*errs.AppError)
	if !ok {
		// fallback unknown error
		ae = errs.Internal("unexpected error")
	}

	prob := Problem{
		Type:   "about:blank",
		Title:  statusText(ae),
		Status: ae.Status(),
		Detail: ae.Message,
	}
	if ae.Detail != nil {
		prob.Extra = ae.Detail
	}

	return c.Status(prob.Status).JSON(prob)
}

func statusText(ae *errs.AppError) string {
	switch ae.Code {
	case errs.CodeBadRequest:
		return http.StatusText(http.StatusBadRequest)
	case errs.CodeUnauthorized:
		return http.StatusText(http.StatusUnauthorized)
	case errs.CodeForbidden:
		return http.StatusText(http.StatusForbidden)
	case errs.CodeNotFound:
		return http.StatusText(http.StatusNotFound)
	case errs.CodeConflict:
		return http.StatusText(http.StatusConflict)
	case errs.CodeUnprocessable:
		return http.StatusText(http.StatusUnprocessableEntity)
	default:
		return http.StatusText(http.StatusInternalServerError)
	}
}
