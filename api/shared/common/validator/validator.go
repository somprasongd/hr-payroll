package validator

import (
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"

	"hrms/shared/common/errs"
)

var validate *validator.Validate

func init() {
	validate = validator.New()

	// Register custom validation for uuid.UUID
	validate.RegisterCustomTypeFunc(func(field reflect.Value) interface{} {
		if val, ok := field.Interface().(uuid.UUID); ok {
			if val == uuid.Nil {
				return ""
			}
			return val.String()
		}
		return nil
	}, uuid.UUID{})
}

// Validate validates a struct using the shared validator instance.
// Returns a BadRequest error with field-specific messages if validation fails.
func Validate(s interface{}) error {
	err := validate.Struct(s)
	if err == nil {
		return nil
	}

	validationErrors, ok := err.(validator.ValidationErrors)
	if !ok {
		return errs.BadRequest("validation failed")
	}

	// Build a user-friendly error message
	var errMsgs []string
	for _, fe := range validationErrors {
		errMsgs = append(errMsgs, fieldErrorMessage(fe))
	}

	return errs.BadRequest(strings.Join(errMsgs, "; "))
}

// fieldErrorMessage converts a FieldError to a human-readable message.
func fieldErrorMessage(fe validator.FieldError) string {
	field := fe.Field()
	tag := fe.Tag()
	param := fe.Param()

	switch tag {
	case "required":
		return field + " is required"
	case "min":
		return field + " must be at least " + param
	case "max":
		return field + " must be at most " + param
	case "email":
		return field + " must be a valid email"
	case "uuid":
		return field + " must be a valid UUID"
	case "gt":
		return field + " must be greater than " + param
	case "gte":
		return field + " must be greater than or equal to " + param
	default:
		return field + " failed on " + tag + " validation"
	}
}
