package errs

import (
	"errors"
	"net/http"
)

type ErrorCode string

const (
	CodeBadRequest    ErrorCode = "bad_request"
	CodeUnauthorized  ErrorCode = "unauthorized"
	CodeForbidden     ErrorCode = "forbidden"
	CodeNotFound      ErrorCode = "not_found"
	CodeConflict      ErrorCode = "conflict"
	CodeUnprocessable ErrorCode = "unprocessable"
	CodeInternal      ErrorCode = "internal_error"
)

// AppError represents domain/http aware error.
type AppError struct {
	Code    ErrorCode
	Message string
	Detail  interface{}
}

func (e *AppError) Error() string {
	return e.Message
}

func (e *AppError) Status() int {
	switch e.Code {
	case CodeBadRequest:
		return http.StatusBadRequest
	case CodeUnauthorized:
		return http.StatusUnauthorized
	case CodeForbidden:
		return http.StatusForbidden
	case CodeNotFound:
		return http.StatusNotFound
	case CodeConflict:
		return http.StatusConflict
	case CodeUnprocessable:
		return http.StatusUnprocessableEntity
	default:
		return http.StatusInternalServerError
	}
}

func BadRequest(msg string, detail ...interface{}) *AppError {
	return &AppError{Code: CodeBadRequest, Message: msg, Detail: pickDetail(detail)}
}

func Unauthorized(msg string) *AppError {
	return &AppError{Code: CodeUnauthorized, Message: msg}
}

func Forbidden(msg string) *AppError {
	return &AppError{Code: CodeForbidden, Message: msg}
}

func NotFound(msg string) *AppError {
	return &AppError{Code: CodeNotFound, Message: msg}
}

func Conflict(msg string) *AppError {
	return &AppError{Code: CodeConflict, Message: msg}
}

func Unprocessable(msg string, detail ...interface{}) *AppError {
	return &AppError{Code: CodeUnprocessable, Message: msg, Detail: pickDetail(detail)}
}

func Internal(msg string, detail ...interface{}) *AppError {
	return &AppError{Code: CodeInternal, Message: msg, Detail: pickDetail(detail)}
}

func pickDetail(detail []interface{}) interface{} {
	if len(detail) > 0 {
		return detail[0]
	}
	return nil
}

func IsConflict(err error) bool {
	var e *AppError
	if ok := errors.As(err, &e); ok {
		return e.Code == CodeConflict
	}
	return false
}
