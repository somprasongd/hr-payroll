module hrms/modules/debt

go 1.25.0

replace hrms/shared/common v0.0.0 => ../../shared/common

replace hrms/shared/events v0.0.0 => ../../shared/events

require (
	github.com/gofiber/fiber/v3 v3.0.0-rc.3
	github.com/google/uuid v1.6.0
	github.com/lib/pq v1.10.9
	go.uber.org/zap v1.27.1
	hrms/shared/common v0.0.0
	hrms/shared/events v0.0.0
)

require (
	github.com/andybalholm/brotli v1.2.0 // indirect
	github.com/gabriel-vasile/mimetype v1.4.12 // indirect
	github.com/go-playground/locales v0.14.1 // indirect
	github.com/go-playground/universal-translator v0.18.1 // indirect
	github.com/go-playground/validator/v10 v10.30.1 // indirect
	github.com/gofiber/schema v1.6.0 // indirect
	github.com/gofiber/utils/v2 v2.0.0-rc.4 // indirect
	github.com/golang-jwt/jwt/v5 v5.3.0 // indirect
	github.com/jmoiron/sqlx v1.4.0 // indirect
	github.com/klauspost/compress v1.18.2 // indirect
	github.com/leodido/go-urn v1.4.0 // indirect
	github.com/mattn/go-colorable v0.1.14 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/philhofer/fwd v1.2.0 // indirect
	github.com/tinylib/msgp v1.6.1 // indirect
	github.com/valyala/bytebufferpool v1.0.0 // indirect
	github.com/valyala/fasthttp v1.68.0 // indirect
	go.uber.org/multierr v1.11.0 // indirect
	golang.org/x/crypto v0.46.0 // indirect
	golang.org/x/net v0.48.0 // indirect
	golang.org/x/sys v0.39.0 // indirect
	golang.org/x/text v0.32.0 // indirect
	hrms/shared/contracts v0.0.0 // indirect
)

replace hrms/shared/contracts v0.0.0 => ../../shared/contracts
