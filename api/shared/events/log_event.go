package events

import (
	"time"

	"github.com/google/uuid"
)

type LogEvent struct {
	ActorID    uuid.UUID
	Action     string
	EntityName string
	EntityID   string
	Details    map[string]interface{}
	Timestamp  time.Time
}

func (e LogEvent) Name() string {
	return "LogEvent"
}
