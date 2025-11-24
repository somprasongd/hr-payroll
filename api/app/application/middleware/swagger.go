package middleware

import (
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v3"
	fiberSwagger "github.com/somprasongd/fiber-swagger"

	"hrms/build"
	"hrms/config"
	"hrms/docs"
)

// APIDoc configures swagger metadata and returns fiber-swagger handler.
func APIDoc(cfg config.Config) fiber.Handler {
	host := removeProtocol(cfg.GatewayHost)
	basePath := cfg.GatewayBasePath
	schemas := []string{"http", "https"}

	if host == "" {
		host = fmt.Sprintf("localhost:%d", cfg.HTTPPort)
	}
	if basePath == "" {
		basePath = "/api/v1"
	}

	docs.SwaggerInfo.Title = "HR Payroll API"
	docs.SwaggerInfo.Description = "HR Payroll REST API"
	docs.SwaggerInfo.Version = build.Version
	docs.SwaggerInfo.Host = host
	docs.SwaggerInfo.BasePath = basePath
	docs.SwaggerInfo.Schemes = schemas

	return fiberSwagger.WrapHandler
}

func removeProtocol(url string) string {
	url = strings.TrimPrefix(url, "http://")
	url = strings.TrimPrefix(url, "https://")
	return url
}
