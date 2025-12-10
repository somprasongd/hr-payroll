package repository

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
)

// TaxBracket represents a progressive tax band. Max=nil means no upper bound.
type TaxBracket struct {
	Min  *float64 `json:"min"`
	Max  *float64 `json:"max"`
	Rate float64  `json:"rate"`
}

type TaxBrackets []TaxBracket

// Value implements driver.Valuer for storing as JSONB.
func (t TaxBrackets) Value() (driver.Value, error) {
	return json.Marshal(t)
}

// Scan implements sql.Scanner for reading JSONB.
func (t *TaxBrackets) Scan(src any) error {
	if src == nil {
		*t = nil
		return nil
	}

	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, t)
	case string:
		return json.Unmarshal([]byte(v), t)
	default:
		return fmt.Errorf("cannot scan %T into TaxBrackets", src)
	}
}
