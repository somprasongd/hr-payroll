package entity

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type ActivityLog struct {
	ID        uuid.UUID       `db:"id" json:"id"`
	UserID    uuid.UUID       `db:"user_id" json:"userId"`
	Action    string          `db:"action" json:"action"`
	Entity    string          `db:"entity" json:"entity"`
	EntityID  string          `db:"entity_id" json:"entityId"`
	Details   json.RawMessage `db:"details" json:"details"`
	CreatedAt time.Time       `db:"created_at" json:"createdAt"`

	// Joined fields
	UserName string `db:"user_name" json:"userName"`
}
