package events

import (
	"time"

	"github.com/google/uuid"
)

const (
	UserCreatedEvent = "UserCreated"
	UserUpdatedEvent = "UserUpdated"
	UserDeletedEvent = "UserDeleted"
)

type UserCreated struct {
	ActorID   uuid.UUID
	UserID    uuid.UUID
	Username  string
	Role      string
	Timestamp time.Time
}

func (e UserCreated) Name() string {
	return UserCreatedEvent
}

type UserUpdated struct {
	ActorID   uuid.UUID
	UserID    uuid.UUID
	Changes   map[string]interface{}
	Timestamp time.Time
}

func (e UserUpdated) Name() string {
	return UserUpdatedEvent
}

type UserDeleted struct {
	ActorID   uuid.UUID
	UserID    uuid.UUID
	Timestamp time.Time
}

func (e UserDeleted) Name() string {
	return UserDeletedEvent
}

const UserPasswordResetEvent = "UserPasswordReset"

type UserPasswordReset struct {
	ActorID      uuid.UUID
	TargetUserID uuid.UUID
	Timestamp    time.Time
}

func (e UserPasswordReset) Name() string {
	return UserPasswordResetEvent
}
