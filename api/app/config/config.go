package config

import (
	"time"

	"github.com/caarlos0/env/v11"
)

type Config struct {
	AppName          string        `env:"APP_NAME" envDefault:"hr-payroll-api"`
	HTTPPort         int           `env:"HTTP_PORT" envDefault:"8080"`
	GatewayHost      string        `env:"GATEWAY_HOST"`
	GatewayBasePath  string        `env:"GATEWAY_BASE_PATH"`
	DSN              string        `env:"DB_DSN,required"`
	JWTAccessSecret  string        `env:"JWT_ACCESS_SECRET,required"`
	JWTRefreshSecret string        `env:"JWT_REFRESH_SECRET,required"`
	AccessTokenTTL   time.Duration `env:"JWT_ACCESS_TTL" envDefault:"15m"`
	RefreshTokenTTL  time.Duration `env:"JWT_REFRESH_TTL" envDefault:"720h"` // default 30d
	GracefulTimeout  time.Duration `env:"GRACEFUL_TIMEOUT" envDefault:"10s"`
}

func Load() (*Config, error) {
	cfg := &Config{}
	if err := env.Parse(cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}
