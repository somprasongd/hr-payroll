package create

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/lib/pq"

	"hrms/modules/user/internal/dto"
	"hrms/modules/user/internal/repository"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/common/password"
	"hrms/shared/common/storage/sqldb/transactor"
)

type Command struct {
	Username   string
	Password   string
	Role       string
	ActorID    uuid.UUID
}

type Response struct {
	dto.User
}

type Handler struct {
	repo repository.Repository
	tx   transactor.Transactor
}

var _ mediator.RequestHandler[*Command, *Response] = (*Handler)(nil)

func NewHandler(repo repository.Repository, tx transactor.Transactor) *Handler {
	return &Handler{
		repo: repo,
		tx:   tx,
	}
}

func (h *Handler) Handle(ctx context.Context, cmd *Command) (*Response, error) {
	cmd.Username = strings.TrimSpace(cmd.Username)
	cmd.Role = strings.TrimSpace(cmd.Role)
	if cmd.Username == "" || cmd.Password == "" || cmd.Role == "" {
		return nil, errs.BadRequest("username, password and role are required")
	}
	if cmd.Role != "admin" && cmd.Role != "hr" {
		return nil, errs.BadRequest("invalid role")
	}

	hash, err := password.Hash(cmd.Password)
	if err != nil {
		return nil, errs.Internal("failed to hash password")
	}

	var created *repository.UserRecord
	err = h.tx.WithinTransaction(ctx, func(ctxTx context.Context, _ func(transactor.PostCommitHook)) error {
		var err error
		created, err = h.repo.CreateUser(ctxTx, cmd.Username, hash, cmd.Role, cmd.ActorID)
		return err
	})
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return nil, errs.Conflict("username already exists")
		}
		return nil, errs.Internal("failed to create user")
	}

	resp := dto.FromRecord(*created)
	return &Response{User: resp}, nil
}
