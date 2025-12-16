package events

import (
	"time"

	"github.com/google/uuid"
)

const (
	EmployeeCreatedEvent = "EmployeeCreated"
	EmployeeUpdatedEvent = "EmployeeUpdated"
	EmployeeDeletedEvent = "EmployeeDeleted"
)

type EmployeeCreated struct {
	ActorID      uuid.UUID
	EmployeeID   uuid.UUID
	EmployeeCode string
	FirstName    string
	LastName     string
	Timestamp    time.Time
}

func (e EmployeeCreated) Name() string {
	return EmployeeCreatedEvent
}

type EmployeeUpdated struct {
	ActorID    uuid.UUID
	EmployeeID uuid.UUID
	Changes    map[string]interface{}
	Timestamp  time.Time
}

func (e EmployeeUpdated) Name() string {
	return EmployeeUpdatedEvent
}

type EmployeeDeleted struct {
	ActorID    uuid.UUID
	EmployeeID uuid.UUID
	Timestamp  time.Time
}

func (e EmployeeDeleted) Name() string {
	return EmployeeDeletedEvent
}
