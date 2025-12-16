package create

import (
	"encoding/json"
	"strings"

	"github.com/google/uuid"
)

// OptionalUUID allows binding empty strings to nil while still accepting valid UUIDs.
type OptionalUUID struct {
	value *uuid.UUID
}

// UnmarshalJSON supports "", null, or a valid UUID string.
func (o *OptionalUUID) UnmarshalJSON(data []byte) error {
	// Treat explicit null as nil
	if string(data) == "null" {
		o.value = nil
		return nil
	}

	var raw string
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	raw = strings.TrimSpace(raw)
	if raw == "" {
		o.value = nil
		return nil
	}

	id, err := uuid.Parse(raw)
	if err != nil {
		return err
	}
	o.value = &id
	return nil
}

// MarshalJSON outputs the UUID string or null.
func (o OptionalUUID) MarshalJSON() ([]byte, error) {
	if o.value == nil {
		return []byte("null"), nil
	}
	return json.Marshal(o.value.String())
}

// Ptr returns the underlying UUID pointer.
func (o OptionalUUID) Ptr() *uuid.UUID {
	return o.value
}
