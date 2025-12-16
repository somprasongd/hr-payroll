module hrms

go 1.25

replace hrms/shared/common v0.0.0 => ../shared/common

replace hrms/modules/auth v0.0.0 => ../modules/auth

replace hrms/modules/employee v0.0.0 => ../modules/employee

replace hrms/modules/payrollconfig v0.0.0 => ../modules/payrollconfig

replace hrms/modules/worklog v0.0.0 => ../modules/worklog

replace hrms/modules/salaryadvance v0.0.0 => ../modules/salaryadvance

replace hrms/modules/salaryraise v0.0.0 => ../modules/salaryraise

replace hrms/modules/user v0.0.0 => ../modules/user

replace hrms/modules/bonus v0.0.0 => ../modules/bonus

replace hrms/modules/debt v0.0.0 => ../modules/debt

replace hrms/modules/payrollrun v0.0.0 => ../modules/payrollrun

replace hrms/modules/masterdata v0.0.0 => ../modules/masterdata

replace hrms/modules/payoutpt v0.0.0 => ../modules/payoutpt

replace hrms/modules/payrollorgprofile v0.0.0 => ../modules/payrollorgprofile

replace hrms/modules/activitylog v0.0.0 => ../modules/activitylog

replace hrms/shared/events v0.0.0 => ../shared/events

require (
	github.com/caarlos0/env/v11 v11.1.0
	github.com/gofiber/fiber/v3 v3.0.0-beta.4
	github.com/somprasongd/fiber-swagger v1.0.1
	github.com/swaggo/swag/v2 v2.0.0-rc4
	hrms/modules/activitylog v0.0.0
	hrms/modules/auth v0.0.0
	hrms/modules/bonus v0.0.0
	hrms/modules/debt v0.0.0
	hrms/modules/employee v0.0.0
	hrms/modules/masterdata v0.0.0
	hrms/modules/payoutpt v0.0.0
	hrms/modules/payrollconfig v0.0.0
	hrms/modules/payrollorgprofile v0.0.0
	hrms/modules/payrollrun v0.0.0
	hrms/modules/salaryadvance v0.0.0
	hrms/modules/salaryraise v0.0.0
	hrms/modules/user v0.0.0
	hrms/modules/worklog v0.0.0
	hrms/shared/common v0.0.0
)

require (
	github.com/KyleBanks/depth v1.2.1 // indirect
	github.com/andybalholm/brotli v1.1.1 // indirect
	github.com/fxamacker/cbor/v2 v2.7.0 // indirect
	github.com/go-openapi/jsonpointer v0.19.6 // indirect
	github.com/go-openapi/jsonreference v0.20.2 // indirect
	github.com/go-openapi/spec v0.20.9 // indirect
	github.com/go-openapi/swag v0.22.3 // indirect
	github.com/gofiber/schema v1.2.0 // indirect
	github.com/gofiber/utils/v2 v2.0.0-beta.7 // indirect
	github.com/golang-jwt/jwt/v5 v5.2.1 // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/jmoiron/sqlx v1.4.0 // indirect
	github.com/josharian/intern v1.0.0 // indirect
	github.com/klauspost/compress v1.17.11 // indirect
	github.com/lib/pq v1.10.9 // indirect
	github.com/mailru/easyjson v0.7.7 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/philhofer/fwd v1.1.3-0.20240916144458-20a13a1f6b7c // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/sv-tools/openapi v0.2.1 // indirect
	github.com/swaggo/files/v2 v2.0.0 // indirect
	github.com/tinylib/msgp v1.2.5 // indirect
	github.com/valyala/bytebufferpool v1.0.0 // indirect
	github.com/valyala/fasthttp v1.58.0 // indirect
	github.com/valyala/tcplisten v1.0.0 // indirect
	github.com/x448/float16 v0.8.4 // indirect
	go.uber.org/multierr v1.10.0 // indirect
	go.uber.org/zap v1.27.0 // indirect
	golang.org/x/crypto v0.32.0 // indirect
	golang.org/x/net v0.34.0 // indirect
	golang.org/x/sys v0.29.0 // indirect
	golang.org/x/text v0.21.0 // indirect
	golang.org/x/tools v0.22.0 // indirect
	gopkg.in/yaml.v2 v2.4.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
	hrms/shared/events v0.0.0 // indirect
)
