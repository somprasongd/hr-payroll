# syntax=docker/dockerfile:1.4
FROM golang:1.25-alpine AS builder

WORKDIR /workspace

# Cache dependencies
RUN mkdir -p app modules/auth modules/user modules/payrollorgprofile shared/common
COPY app/go.mod app/go.sum app/
COPY modules/auth/go.mod modules/auth/go.sum modules/auth/
COPY modules/user/go.mod modules/user/go.sum modules/user/
COPY shared/common/go.mod shared/common/go.sum shared/common/

COPY modules/auth/go.mod modules/auth/go.sum modules/auth/
COPY modules/user/go.mod modules/user/go.sum modules/user/
COPY modules/employee/go.mod modules/employee/go.sum modules/employee/
COPY modules/payrollconfig/go.mod modules/payrollconfig/go.sum modules/payrollconfig/
COPY modules/worklog/go.mod modules/worklog/go.sum modules/worklog/
COPY modules/salaryadvance/go.mod modules/salaryadvance/go.sum modules/salaryadvance/
COPY modules/salaryraise/go.mod modules/salaryraise/go.sum modules/salaryraise/
COPY modules/bonus/go.mod modules/bonus/go.sum modules/bonus/
COPY modules/debt/go.mod modules/debt/go.sum modules/debt/
COPY modules/payrollrun/go.mod modules/payrollrun/go.sum modules/payrollrun/
COPY modules/payrollorgprofile/go.mod modules/payrollorgprofile/go.sum modules/payrollorgprofile/
COPY modules/masterdata/go.mod modules/masterdata/go.sum modules/masterdata/
COPY modules/payoutpt/go.mod modules/payoutpt/go.sum modules/payoutpt/
COPY modules/activitylog/go.mod modules/activitylog/go.sum modules/activitylog/
COPY modules/dashboard/go.mod modules/dashboard/go.sum modules/dashboard/
COPY shared/events/go.mod shared/events/go.sum shared/events/

RUN cd app && go mod download

# Install migrate CLI (static) for linux
ARG MIGRATE_VERSION=v4.19.1
RUN CGO_ENABLED=0 go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@${MIGRATE_VERSION}

# Copy API source
COPY . .

RUN cd app && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/hr-payroll-api ./cmd/api

# Copy migrations from additional context for runtime
COPY --from=migrations / /workspace/migrations

FROM gcr.io/distroless/base-debian12:nonroot
# Copy wget from busybox
COPY --from=busybox:1.36.1-uclibc /bin/wget /bin/wget
WORKDIR /app
COPY --from=builder /out/hr-payroll-api /app/hr-payroll-api
COPY --from=builder /go/bin/migrate /app/migrate
COPY --from=builder /workspace/migrations /app/migrations

EXPOSE 8080

ENTRYPOINT ["/app/hr-payroll-api"]
