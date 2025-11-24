FROM golang:1.25-alpine AS builder

WORKDIR /workspace

# Cache dependencies
RUN mkdir -p app modules/auth modules/user shared/common
COPY app/go.mod app/go.sum app/
COPY modules/auth/go.mod modules/auth/go.sum modules/auth/
COPY modules/user/go.mod modules/user/go.sum modules/user/
COPY shared/common/go.mod shared/common/go.sum shared/common/

RUN cd app && go mod download

# Copy source
COPY . .

RUN cd app && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/hr-payroll-api ./cmd/api

FROM gcr.io/distroless/base-debian12:nonroot
WORKDIR /app
COPY --from=builder /out/hr-payroll-api /app/hr-payroll-api

EXPOSE 8080

ENTRYPOINT ["/app/hr-payroll-api"]
