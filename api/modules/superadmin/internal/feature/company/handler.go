package company

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"hrms/modules/superadmin/internal/repository"
	"hrms/shared/common/contextx"
	"hrms/shared/common/errs"
	"hrms/shared/common/eventbus"
	"hrms/shared/common/logger"
	"hrms/shared/common/storage/sqldb/transactor"
	"hrms/shared/events"
)

// CreateCompanyRequest for creating a new company with admin user
type CreateCompanyRequest struct {
	CompanyCode   string `json:"companyCode" validate:"required,max=50"`
	CompanyName   string `json:"companyName" validate:"required,max=200"`
	AdminUsername string `json:"adminUsername" validate:"required,min=3,max=50"`
	AdminPassword string `json:"adminPassword" validate:"required,min=8"`
}

// CreateCompanyResponse returned after company creation
type CreateCompanyResponse struct {
	Company repository.Company `json:"company"`
	Branch  repository.Branch  `json:"branch"`
	AdminID uuid.UUID          `json:"adminUserId"`
}

// Handler for company endpoints
type Handler struct {
	repo repository.Repository
	tx   transactor.Transactor
	eb   eventbus.EventBus
}

// NewHandler creates a new company handler
func NewHandler(repo repository.Repository, tx transactor.Transactor, eb eventbus.EventBus) *Handler {
	return &Handler{repo: repo, tx: tx, eb: eb}
}

// Create handles POST /super-admin/companies
func (h *Handler) Create(c fiber.Ctx) error {
	var req CreateCompanyRequest
	if err := c.Bind().JSON(&req); err != nil {
		return errs.BadRequest("invalid request body")
	}

	// Validate
	if req.CompanyCode == "" || req.CompanyName == "" {
		return errs.BadRequest("companyCode and companyName are required")
	}
	if req.AdminUsername == "" || req.AdminPassword == "" {
		return errs.BadRequest("adminUsername and adminPassword are required")
	}
	if len(req.AdminPassword) < 8 {
		return errs.BadRequest("password must be at least 8 characters")
	}

	ctx := c.Context()
	user, _ := contextx.UserFromContext(ctx)

	var resp CreateCompanyResponse

	err := h.tx.WithinTransaction(ctx, func(txCtx context.Context, registerHook func(transactor.PostCommitHook)) error {
		// 1. Create company
		company, err := h.repo.CreateCompany(txCtx, req.CompanyCode, req.CompanyName, user.ID.String())
		if err != nil {
			logger.FromContext(ctx).Error("failed to create company", zap.Error(err))
			return errs.Internal("failed to create company")
		}
		resp.Company = *company

		// 2. Create default branch (HQ)
		branch, err := h.repo.CreateDefaultBranch(txCtx, company.ID, user.ID.String())
		if err != nil {
			logger.FromContext(ctx).Error("failed to create default branch", zap.Error(err))
			return errs.Internal("failed to create default branch")
		}
		resp.Branch = *branch

		// 3. Create admin user for this company
		adminID, err := h.repo.CreateUser(txCtx, req.AdminUsername, req.AdminPassword, "admin", user.ID)
		if err != nil {
			logger.FromContext(ctx).Error("failed to create admin user", zap.Error(err))
			return errs.Internal("failed to create admin user")
		}
		resp.AdminID = adminID

		// 4. Assign admin to company
		if err := h.repo.AssignUserToCompany(txCtx, adminID, company.ID, "admin", user.ID.String()); err != nil {
			logger.FromContext(ctx).Error("failed to assign user to company", zap.Error(err))
			return errs.Internal("failed to assign user to company")
		}

		// 5. Assign admin to default branch
		if err := h.repo.AssignUserToBranch(txCtx, adminID, branch.ID, user.ID.String()); err != nil {
			logger.FromContext(ctx).Error("failed to assign user to branch", zap.Error(err))
			return errs.Internal("failed to assign user to branch")
		}

		registerHook(func(ctx context.Context) error {
			companyID := resp.Company.ID
			branchID := resp.Branch.ID
			h.eb.Publish(events.LogEvent{
				ActorID:    user.ID,
				CompanyID:  &companyID,
				BranchID:   &branchID,
				Action:     "CREATE",
				EntityName: "COMPANY",
				EntityID:   companyID.String(),
				Details: map[string]interface{}{
					"code":          resp.Company.Code,
					"name":          resp.Company.Name,
					"status":        resp.Company.Status,
					"defaultBranch": resp.Branch.Code,
					"branchName":    resp.Branch.Name,
					"adminUserId":   resp.AdminID.String(),
				},
				Timestamp: time.Now(),
			})
			return nil
		})

		return nil
	})

	if err != nil {
		return err
	}

	return c.Status(fiber.StatusCreated).JSON(resp)
}

// List handles GET /super-admin/companies
func (h *Handler) List(c fiber.Ctx) error {
	ctx := c.Context()
	companies, err := h.repo.ListCompanies(ctx)
	if err != nil {
		logger.FromContext(ctx).Error("failed to list companies", zap.Error(err))
		return errs.Internal("failed to list companies")
	}
	return c.JSON(companies)
}

// Get handles GET /super-admin/companies/:id
func (h *Handler) Get(c fiber.Ctx) error {
	ctx := c.Context()
	idParam := c.Params("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return errs.BadRequest("invalid company id")
	}

	company, err := h.repo.GetCompanyByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errs.NotFound("company not found")
		}
		logger.FromContext(ctx).Error("failed to get company", zap.Error(err))
		return errs.Internal("failed to get company")
	}
	return c.JSON(company)
}

// UpdateRequest for updating a company
type UpdateRequest struct {
	Code   string `json:"code"`
	Name   string `json:"name"`
	Status string `json:"status"`
}

// Update handles PATCH /super-admin/companies/:id
func (h *Handler) Update(c fiber.Ctx) error {
	ctx := c.Context()
	idParam := c.Params("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return errs.BadRequest("invalid company id")
	}

	var req UpdateRequest
	if err := c.Bind().JSON(&req); err != nil {
		return errs.BadRequest("invalid request body")
	}

	user, _ := contextx.UserFromContext(ctx)

	company, err := h.repo.UpdateCompany(ctx, id, req.Code, req.Name, req.Status, user.ID.String())
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errs.NotFound("company not found")
		}
		logger.FromContext(ctx).Error("failed to update company", zap.Error(err))
		return errs.Internal("failed to update company")
	}

	companyID := company.ID
	h.eb.Publish(events.LogEvent{
		ActorID:    user.ID,
		CompanyID:  &companyID,
		Action:     "UPDATE",
		EntityName: "COMPANY",
		EntityID:   companyID.String(),
		Details: map[string]interface{}{
			"code":   company.Code,
			"name":   company.Name,
			"status": company.Status,
		},
		Timestamp: time.Now(),
	})

	return c.JSON(company)
}
