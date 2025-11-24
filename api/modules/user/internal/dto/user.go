package dto

import (
	"time"

	"github.com/google/uuid"

	"hrms/modules/user/internal/repository"
)

type User struct {
	ID          uuid.UUID  `json:"id"`
	Username    string     `json:"username"`
	Role        string     `json:"role"`
	CreatedAt   time.Time  `json:"createdAt"`
	LastLoginAt *time.Time `json:"lastLoginAt,omitempty"`
}

type Meta struct {
	CurrentPage int `json:"currentPage"`
	TotalPages  int `json:"totalPages"`
	TotalItems  int `json:"totalItems"`
}

func FromRecord(u repository.UserRecord) User {
	var last *time.Time
	if u.LastLogin.Valid {
		t := u.LastLogin.Time
		last = &t
	}
	return User{
		ID:          u.ID,
		Username:    u.Username,
		Role:        u.Role,
		CreatedAt:   u.CreatedAt,
		LastLoginAt: last,
	}
}
