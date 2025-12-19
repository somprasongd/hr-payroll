package doctype

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/mediator"
	"hrms/shared/contracts"
)

// DocumentTypeRequest for creating/updating document types
type DocumentTypeRequest struct {
	Code   string `json:"code"`
	NameTh string `json:"nameTh"`
	NameEn string `json:"nameEn"`
}

// Handler for document type endpoints
type Handler struct{}

// NewHandler creates a new document type handler
func NewHandler() *Handler {
	return &Handler{}
}

// List handles GET /super-admin/employee-document-types
func (h *Handler) List(c fiber.Ctx) error {
	ctx := c.Context()
	resp, err := mediator.Send[*contracts.ListSystemDocTypesQuery, *contracts.ListSystemDocTypesResponse](ctx, &contracts.ListSystemDocTypesQuery{})
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"items": resp.Items})
}

// Create handles POST /super-admin/employee-document-types
func (h *Handler) Create(c fiber.Ctx) error {
	var req DocumentTypeRequest
	if err := c.Bind().JSON(&req); err != nil {
		return errs.BadRequest("invalid request body")
	}

	ctx := c.Context()
	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return errs.Unauthorized("missing user")
	}

	resp, err := mediator.Send[*contracts.CreateSystemDocTypeCommand, *contracts.CreateSystemDocTypeResponse](ctx, &contracts.CreateSystemDocTypeCommand{
		Code:    req.Code,
		NameTh:  req.NameTh,
		NameEn:  req.NameEn,
		ActorID: user.ID,
	})
	if err != nil {
		return err
	}

	return c.Status(fiber.StatusCreated).JSON(resp)
}

// Update handles PUT /super-admin/employee-document-types/:id
func (h *Handler) Update(c fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return errs.BadRequest("invalid document type id")
	}

	var req DocumentTypeRequest
	if err := c.Bind().JSON(&req); err != nil {
		return errs.BadRequest("invalid request body")
	}

	ctx := c.Context()
	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return errs.Unauthorized("missing user")
	}

	resp, err := mediator.Send[*contracts.UpdateSystemDocTypeCommand, *contracts.UpdateSystemDocTypeResponse](ctx, &contracts.UpdateSystemDocTypeCommand{
		ID:      id,
		Code:    req.Code,
		NameTh:  req.NameTh,
		NameEn:  req.NameEn,
		ActorID: user.ID,
	})
	if err != nil {
		return err
	}

	return c.JSON(resp)
}

// Delete handles DELETE /super-admin/employee-document-types/:id
func (h *Handler) Delete(c fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return errs.BadRequest("invalid document type id")
	}

	ctx := c.Context()
	user, ok := contextx.UserFromContext(ctx)
	if !ok {
		return errs.Unauthorized("missing user")
	}

	_, err = mediator.Send[*contracts.DeleteSystemDocTypeCommand, mediator.NoResponse](ctx, &contracts.DeleteSystemDocTypeCommand{
		ID:      id,
		ActorID: user.ID,
	})
	if err != nil {
		return err
	}

	return c.SendStatus(fiber.StatusNoContent)
}
