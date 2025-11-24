package application

import (
	"context"
	"fmt"
	"net/http"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/recover"

	"hrms/config"
	appmw "hrms/application/middleware"
	"hrms/shared/common/logger"
	mw "hrms/shared/common/middleware"
)

type HTTPServer interface {
	Start()
	Shutdown() error
	Group(prefix string) fiber.Router
}

type httpServer struct {
	config config.Config
	app    *fiber.App
}

func newHTTPServer(cfg config.Config) HTTPServer {
	return &httpServer{
		config: cfg,
		app:    newFiber(cfg),
	}
}

func newFiber(cfg config.Config) *fiber.App {
	app := fiber.New(fiber.Config{
		AppName: cfg.AppName,
	})

	app.Use(mw.RequestLogger())
	app.Use(cors.New())
	app.Use(recover.New())
	app.Use(mw.ErrorHandler())

	app.Get("/docs/*", appmw.APIDoc(cfg))

	app.Get("/", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{"app": cfg.AppName})
	})

	return app
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
