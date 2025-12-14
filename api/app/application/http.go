package application

import (
	"context"
	"fmt"
	"net/http"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/recover"

	"hrms/shared/common/logger"
	mw "hrms/shared/common/middleware"

	"hrms/application/middleware"
	"hrms/build"
	"hrms/config"
)

type HTTPServer interface {
	Start()
	Shutdown() error
	Group(prefix string) fiber.Router
}

type HealthCheck func(ctx context.Context) error

type httpServer struct {
	config config.Config
	app    *fiber.App
}

func newHTTPServer(cfg config.Config, healthCheck HealthCheck) HTTPServer {
	return &httpServer{
		config: cfg,
		app:    newFiber(cfg, healthCheck),
	}
}

func newFiber(cfg config.Config, healthCheck HealthCheck) *fiber.App {
	app := fiber.New(fiber.Config{
		AppName: cfg.AppName,
	})

	app.Use(mw.RequestLogger())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		AllowMethods:     []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"},
		AllowCredentials: false,
	}))
	// Ensure CORS headers are present even when downstream returns an error
	app.Use(func(c fiber.Ctx) error {
		c.Set(fiber.HeaderAccessControlAllowOrigin, "*")
		c.Set(fiber.HeaderAccessControlAllowHeaders, "Origin, Content-Type, Accept, Authorization")
		c.Set(fiber.HeaderAccessControlAllowMethods, "GET,POST,PATCH,PUT,DELETE,OPTIONS")
		if c.Method() == fiber.MethodOptions {
			return c.SendStatus(http.StatusNoContent)
		}
		return c.Next()
	})
	app.Use(recover.New())
	app.Use(mw.ErrorHandler())

	app.Get("/favicon.ico", func(c fiber.Ctx) error {
		return c.SendStatus(http.StatusNoContent)
	})
	app.Get("/docs/*", middleware.APIDoc(cfg))
	registerHealthRoutes(app, cfg, healthCheck)

	return app
}

func registerHealthRoutes(app *fiber.App, cfg config.Config, healthCheck HealthCheck) {
	handler := healthHandler(cfg, healthCheck)
	for _, route := range []string{"/", "/health", "/api/health", "/api/v1/health"} {
		app.Get(route, handler)
	}
}

func healthHandler(cfg config.Config, healthCheck HealthCheck) fiber.Handler {
	return func(c fiber.Ctx) error {
		resp := fiber.Map{
			"status":  "ok",
			"app":     cfg.AppName,
			"version": build.Version,
		}

		if healthCheck != nil {
			if err := healthCheck(c.Context()); err != nil {
				resp["status"] = "unhealthy"
				resp["error"] = err.Error()
				return c.Status(http.StatusServiceUnavailable).JSON(resp)
			}
		}

		return c.JSON(resp)
	}
}

func (s *httpServer) Start() {
	go func() {
		addr := fmt.Sprintf(":%d", s.config.HTTPPort)
		logger.Log().Info(fmt.Sprintf("starting http server on %s", addr))
		if err := s.app.Listen(addr); err != nil && err != http.ErrServerClosed {
			logger.Log().Fatal(fmt.Sprintf("failed to start server: %v", err))
		}
	}()
}

func (s *httpServer) Shutdown() error {
	ctx, cancel := context.WithTimeout(context.Background(), s.config.GracefulTimeout)
	defer cancel()
	return s.app.ShutdownWithContext(ctx)
}

func (s *httpServer) Group(prefix string) fiber.Router {
	return s.app.Group(prefix)
}
