package http

import (
	"net/http"
	"strconv"

	"hrms/modules/activitylog/internal/repository"
	"hrms/shared/common/logger"

	"github.com/gofiber/fiber/v3"
	"go.uber.org/zap"
)

type Handler struct {
	repo *repository.Repository
}

func NewHandler(repo *repository.Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) ListLogs(c fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "10"))

	filter := repository.ListFilter{
		Action:   c.Query("action"),
		Entity:   c.Query("entity"),
		FromDate: c.Query("fromDate"),
		ToDate:   c.Query("toDate"),
		UserName: c.Query("userName"),
	}

	logs, total, err := h.repo.ListLogs(c.Context(), filter, page, limit)
	if err != nil {
		logger.FromContext(c.Context()).Error("failed to list activity logs", zap.Error(err))
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"data": logs,
		"meta": fiber.Map{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}
