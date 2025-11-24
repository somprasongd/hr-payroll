module hrms/modules/masterdata

go 1.25

replace hrms/shared/common v0.0.0 => ../../shared/common

require (
    github.com/gofiber/fiber/v3 v3.0.0-beta.4
    hrms/shared/common v0.0.0
)

require (
    github.com/andybalholm/brotli v1.1.1 // indirect
    github.com/gofiber/utils/v2 v2.0.0-beta.7 // indirect
    github.com/klauspost/compress v1.17.11 // indirect
    github.com/mattn/go-colorable v0.1.13 // indirect
    github.com/mattn/go-isatty v0.0.20 // indirect
    github.com/valyala/bytebufferpool v1.0.0 // indirect
    github.com/valyala/fasthttp v1.58.0 // indirect
    github.com/valyala/tcplisten v1.0.0 // indirect
)
