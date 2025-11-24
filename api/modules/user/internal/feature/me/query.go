package me

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"

	"hrms/modules/user/internal/dto"
	"hrms/modules/user/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
)

type Query struct {
	UserID uuid.UUID
}

type Response struct {
	dto.User
}

type Handler struct {
	repo repository.Repository
}

var _ mediator.RequestHandler[*Query, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Handle(ctx context.Context, q *Query) (*Response, error) {
	rec, err := h.repo.GetUser(ctx, q.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errs.NotFound("user not found")
		}
		return nil, errs.Internal("failed to load profile")
	}
	return &Response{User: dto.FromRecord(*rec)}, nil
}
